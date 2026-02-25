import { NextRequest, NextResponse } from 'next/server'

interface RequestBody {
  markdown: string
  apiKey: string
  baseUrl: string
  modelName: string
  modelType: string
}

// ---- Copied from guide/route.ts to avoid modifying existing route ----

function parseApiError(status: number, rawError: string): string {
  switch (status) {
    case 401: return '认证失败：API Key 无效或已过期'
    case 403: return '权限不足：API Key 没有访问该模型的权限'
    case 404: return '接口不存在：请检查 Base URL 是否正确'
    case 429: return '请求过于频繁，请稍后再试'
    case 500: case 502: case 503: return 'AI 服务暂时不可用，请稍后再试'
    default: {
      try {
        const parsed = JSON.parse(rawError)
        return parsed?.error?.message || parsed?.message || `API 错误 (${status})`
      } catch {
        return `API 错误 (${status}): ${rawError.slice(0, 200)}`
      }
    }
  }
}

function getApiConfig(body: RequestBody) {
  const apiKey = body.apiKey || ''
  const modelType = body.modelType || ''
  let baseUrl = body.baseUrl || ''
  let modelName = body.modelName || ''

  if (modelType && !baseUrl) {
    if (modelType === 'openai') baseUrl = 'https://api.openai.com/v1'
    else if (modelType === 'claude') baseUrl = 'https://api.anthropic.com'
  }

  if (modelType && !modelName) {
    if (modelType === 'openai') modelName = 'gpt-4o'
    else if (modelType === 'claude') modelName = 'claude-sonnet-4'
  }

  if (modelType === 'claude' && baseUrl) {
    baseUrl = baseUrl.replace(/\/v1\/?$/, '')
  }

  return { apiKey, baseUrl, modelName, modelType }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429 || attempt === maxRetries) return res

    const retryAfter = res.headers.get('retry-after')
    const waitMs = retryAfter
      ? Math.min(parseInt(retryAfter, 10) * 1000, 30000)
      : Math.min(1000 * Math.pow(2, attempt), 15000)

    await new Promise((r) => setTimeout(r, waitMs))
  }
  throw new Error('请求过于频繁，重试后仍然失败')
}

async function callOpenAICompatible(
  config: ReturnType<typeof getApiConfig>,
  messages: Array<{ role: string; content: string }>,
  tools: unknown[],
  maxTokens: number
) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages,
      max_tokens: maxTokens,
      tools: tools.map((f: any) => ({
        type: 'function',
        function: { name: f.name, description: f.description, parameters: f.parameters },
      })),
      tool_choice: { type: 'function', function: { name: 'import_plan' } },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(parseApiError(res.status, err))
  }

  return await res.json()
}

async function callClaude(
  config: ReturnType<typeof getApiConfig>,
  messages: Array<{ role: string; content: string }>,
  tools: unknown[],
  maxTokens: number
) {
  const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const claudeUrl = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`

  const res = await fetchWithRetry(claudeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.modelName,
      max_tokens: maxTokens,
      system: systemMsg,
      messages: chatMessages,
      tools: tools.map((f: any) => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters,
      })),
      tool_choice: { type: 'tool', name: 'import_plan' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(parseApiError(res.status, err))
  }

  const data = await res.json()

  // Normalize Claude response to OpenAI format
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolUse) {
    return {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: toolUse.name,
                  arguments: JSON.stringify(toolUse.input),
                },
              },
            ],
          },
        },
      ],
    }
  }

  return { choices: [{ message: { tool_calls: null } }] }
}

// ---- End copied helpers ----

const IMPORT_SYSTEM_PROMPT = `你是一个项目计划解析助手。你的任务是从用户提供的 Markdown 文档中提取项目信息，并映射到结构化的阶段数据。

你需要尽可能从文档中提取以下 4 个阶段的信息：
1. concept（概念）：项目名称、描述、目标用户
2. features（功能）：功能模块列表
3. ui-pages（页面）：页面/界面列表
4. tech-impl（技术实现）：技术栈、实现模块（含任务列表）、决策记录

规则：
1. 如果文档中某个阶段的信息不存在或不充分，就跳过该阶段，不要编造数据
2. slug 字段使用纯小写字母、数字和连字符
3. 任务 ID 格式：{module-slug}-{nn}，如 user-auth-01
4. 尽量保留文档中的原始信息，不要过度概括
5. 你必须调用 import_plan 函数返回结果`

const IMPORT_FUNCTION = {
  name: 'import_plan',
  description: '将解析出的项目计划数据导入系统',
  parameters: {
    type: 'object' as const,
    properties: {
      phases: {
        type: 'array',
        description: '解析出的阶段数据数组',
        items: {
          type: 'object',
          properties: {
            phase: {
              type: 'string',
              enum: ['concept', 'features', 'ui-pages', 'tech-impl'],
              description: '阶段类型',
            },
            // concept fields
            project_name: { type: 'string', description: '项目名称（concept 阶段）' },
            description: { type: 'string', description: '项目描述（concept 阶段）' },
            target_users: { type: 'string', description: '目标用户（concept 阶段）' },
            message: { type: 'string', description: '阶段说明' },
            // features fields
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  module: { type: 'string', description: '模块名称' },
                  slug: { type: 'string', description: '模块标识符' },
                  overview: { type: 'string', description: '模块概述' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                  depends_on: { type: 'array', items: { type: 'string' } },
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        detail: { type: 'string' },
                        depends_on: { type: 'array', items: { type: 'string' } },
                        files_to_create: { type: 'array', items: { type: 'string' } },
                        files_to_modify: { type: 'array', items: { type: 'string' } },
                        acceptance_criteria: { type: 'array', items: { type: 'string' } },
                      },
                      required: ['id', 'title', 'detail'],
                    },
                  },
                },
                required: ['module', 'slug', 'overview'],
              },
            },
            // ui-pages fields
            pages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  module: { type: 'string' },
                  slug: { type: 'string' },
                  overview: { type: 'string' },
                },
                required: ['module', 'slug', 'overview'],
              },
            },
            // tech-impl fields
            tech_stack: { type: 'array', items: { type: 'string' } },
            decisions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  decision_id: { type: 'number' },
                  question: { type: 'string' },
                  chosen: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['decision_id', 'question', 'chosen', 'reason'],
              },
            },
          },
          required: ['phase', 'message'],
        },
      },
    },
    required: ['phases'],
  },
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()

    if (!body.apiKey) {
      return NextResponse.json(
        { error: '请先在设置中配置 API Key' },
        { status: 400 }
      )
    }

    if (!body.markdown || body.markdown.trim().length === 0) {
      return NextResponse.json(
        { error: '文档内容为空' },
        { status: 400 }
      )
    }

    const config = getApiConfig(body)

    const messages = [
      { role: 'system', content: IMPORT_SYSTEM_PROMPT },
      { role: 'user', content: `请解析以下 Markdown 文档并提取项目计划信息：\n\n${body.markdown}` },
    ]

    const aiResponse =
      config.modelType === 'claude'
        ? await callClaude(config, messages, [IMPORT_FUNCTION], 8192)
        : await callOpenAICompatible(config, messages, [IMPORT_FUNCTION], 8192)

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      return NextResponse.json(
        { error: 'AI 未返回结构化数据，请重试' },
        { status: 502 }
      )
    }

    const fnArgs = JSON.parse(toolCall.function.arguments)
    const phases = fnArgs.phases || []

    return NextResponse.json({ phases })
  } catch (e) {
    const message = e instanceof Error ? e.message : '服务器内部错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
