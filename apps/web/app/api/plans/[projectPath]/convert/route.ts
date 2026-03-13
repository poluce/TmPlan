import { NextRequest, NextResponse } from 'next/server'
import {
  initPlansDir,
  writePlanProject,
  writePlanModule,
  writePlanDecision,
  writePlanCache,
} from '@/lib/tmplan/writer'
import { logServerError, logServerInfo, logServerWarn } from '@/lib/logging/server-logger'

interface DocFile {
  path: string
  name: string
  content: string
}

interface RequestBody {
  docs: DocFile[]
  apiKey: string
  baseUrl: string
  modelName: string
  modelType: string
  traceId?: string
}

// ---- AI helpers (shared pattern with parse-markdown) ----

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

function getApiConfig(body: Pick<RequestBody, 'apiKey' | 'baseUrl' | 'modelName' | 'modelType'>) {
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

type AiConfig = ReturnType<typeof getApiConfig>
type Message = { role: string; content: string }

function resolveTraceId(req: NextRequest, bodyTraceId?: string): string {
  const headerTraceId = req.headers.get('x-trace-id')
  if (headerTraceId) return headerTraceId
  if (bodyTraceId) return bodyTraceId
  return `convert_${Date.now()}_${crypto.randomUUID()}`
}

async function logConvert(level: 'info' | 'warn' | 'error', traceId: string, message: string, metadata: Record<string, unknown>) {
  const payload = { traceId, ...metadata }
  console[level](`[convert][server] ${message}`, payload)

  if (level === 'info') {
    await logServerInfo('convert', message, payload)
    return
  }

  if (level === 'warn') {
    await logServerWarn('convert', message, payload)
    return
  }

  await logServerError('convert', message, payload)
}

async function callOpenAICompatible(
  config: AiConfig,
  messages: Message[],
  tools: unknown[],
  toolName: string,
  maxTokens: number,
  traceId: string
) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const requestBody = JSON.stringify({
    model: config.modelName,
    messages,
    max_tokens: maxTokens,
    tools: tools.map((f: any) => ({
      type: 'function',
      function: { name: f.name, description: f.description, parameters: f.parameters },
    })),
    tool_choice: { type: 'function', function: { name: toolName } },
  })
  await logConvert('info', traceId, 'AI request prepared', {
    provider: 'openai-compatible',
    modelName: config.modelName,
    maxTokens,
    requestSizeKb: Number((requestBody.length / 1024).toFixed(1)),
    messageCount: messages.length,
    toolsCount: tools.length,
  })

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: requestBody,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(parseApiError(res.status, err))
  }

  const rawText = await res.text()
  await logConvert('info', traceId, 'AI response received', {
    provider: 'openai-compatible',
    status: res.status,
    responseSizeKb: Number((rawText.length / 1024).toFixed(1)),
  })

  try {
    return JSON.parse(rawText)
  } catch {
    await logConvert('error', traceId, 'AI response JSON parse failed', {
      provider: 'openai-compatible',
      responseSizeKb: Number((rawText.length / 1024).toFixed(1)),
    })
    throw new Error('AI 响应格式异常，无法解析')
  }
}

async function callClaude(
  config: AiConfig,
  messages: Message[],
  tools: unknown[],
  toolName: string,
  maxTokens: number,
  traceId: string
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
      tool_choice: { type: 'tool', name: toolName },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(parseApiError(res.status, err))
  }

  const data = await res.json()
  await logConvert('info', traceId, 'AI response received', {
    provider: 'claude',
    status: res.status,
    contentBlocks: Array.isArray(data.content) ? data.content.length : 0,
  })
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolUse) {
    return {
      choices: [{
        message: {
          tool_calls: [{
            function: { name: toolUse.name, arguments: JSON.stringify(toolUse.input) },
          }],
        },
      }],
    }
  }

  return { choices: [{ message: { tool_calls: null } }] }
}

// ---- Convert-specific prompt & function ----

const CONVERT_SYSTEM_PROMPT = `你是一个项目计划转换助手。你的任务是从用户提供的项目文档中提取结构化的计划数据。

你需要从文档中提取：
1. 项目名称和描述
2. 功能模块列表（每个模块包含名称、概述、优先级、依赖关系和任务列表）
3. 技术决策记录（如果文档中有相关内容）

规则：
1. 模块名称（module）必须使用中文，禁止输出英文模块名；只有 slug 可以是英文
2. 任务标题（title）和任务详情（detail）优先使用中文，除非文档中只有不可翻译的专有名词
3. slug 字段仍使用纯小写字母、数字和连字符（如 user-auth, data-sync）
4. 任务 ID 格式：{module-slug}-{nn}，如 user-auth-01
5. 尽量保留文档中的原始信息，不要过度概括或编造数据
6. 如果文档中没有明确的决策记录，decisions 数组留空
7. 每个模块至少提取一个任务
8. 你必须调用 convert_docs 函数返回结果`

const CONVERT_FUNCTION = {
  name: 'convert_docs',
  description: '将文档转换为结构化的项目计划数据',
  parameters: {
    type: 'object' as const,
    properties: {
      project_name: { type: 'string', description: '项目名称' },
      project_description: { type: 'string', description: '项目描述' },
      modules: {
        type: 'array',
        description: '功能模块列表',
        items: {
          type: 'object',
          properties: {
            module: { type: 'string', description: '模块名称' },
            slug: { type: 'string', description: '模块标识符（小写字母、数字、连字符）' },
            overview: { type: 'string', description: '模块概述' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            depends_on: { type: 'array', items: { type: 'string' }, description: '依赖的模块 slug 列表' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: '任务 ID，格式 {module-slug}-{nn}' },
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
      decisions: {
        type: 'array',
        description: '技术决策记录',
        items: {
          type: 'object',
          properties: {
            decision_id: { type: 'number' },
            question: { type: 'string' },
            chosen: { type: 'string' },
            reason: { type: 'string' },
            context: { type: 'string' },
            affected_modules: { type: 'array', items: { type: 'string' } },
          },
          required: ['decision_id', 'question', 'chosen', 'reason'],
        },
      },
    },
    required: ['project_name', 'modules'],
  },
}

// ---- Route handler ----

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  const { projectPath } = await params
  const basePath = decodeURIComponent(projectPath)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }

  if (!body.apiKey) {
    return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 })
  }

  if (!body.docs || body.docs.length === 0) {
    return NextResponse.json({ error: '暂无文档可转换' }, { status: 400 })
  }

  const config = getApiConfig(body)
  const traceId = resolveTraceId(req, body.traceId)

  await logConvert('info', traceId, 'Convert request received', {
    projectPath: basePath,
    docsCount: body.docs.length,
    docPaths: body.docs.map((doc) => doc.path),
    modelType: config.modelType,
    modelName: config.modelName,
    baseUrlConfigured: Boolean(config.baseUrl),
  })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Reading phase
        const markdownParts: string[] = []
        for (let i = 0; i < body.docs.length; i++) {
          const doc = body.docs[i]
          send({ step: 'reading', doc: doc.path })
          markdownParts.push(`# ${doc.name}\n\n${doc.content}`)
          // 让每个 reading 事件有时间到达客户端并渲染
          if (i < body.docs.length - 1) {
            await new Promise((r) => setTimeout(r, 350))
          }
        }
        // 最后一个 doc 读完后也留一点时间再进入分析阶段
        await new Promise((r) => setTimeout(r, 350))
        const markdown = markdownParts.join('\n\n---\n\n')

        // Analyzing phase
        send({ step: 'analyzing', docsCount: body.docs.length })
        await logConvert('info', traceId, 'Analyzing docs', {
          docsCount: body.docs.length,
        })

        const messages: Message[] = [
          { role: 'system', content: CONVERT_SYSTEM_PROMPT },
          { role: 'user', content: `请分析以下项目文档并提取结构化的计划数据：\n\n${markdown}` },
        ]

        const aiResponse =
          config.modelType === 'claude'
            ? await callClaude(config, messages, [CONVERT_FUNCTION], 'convert_docs', 8192, traceId)
            : await callOpenAICompatible(config, messages, [CONVERT_FUNCTION], 'convert_docs', 8192, traceId)

        const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0]
        if (!toolCall) {
          send({ step: 'error', message: 'AI 未返回结构化数据，请重试' })
          controller.close()
          return
        }

        const result = JSON.parse(toolCall.function.arguments)
        await logConvert('info', traceId, 'AI structured result parsed', {
          resultKeys: Object.keys(result),
          modulesCount: Array.isArray(result.modules) ? result.modules.length : 0,
          decisionsCount: Array.isArray(result.decisions) ? result.decisions.length : 0,
        })

        if (!result.modules || result.modules.length === 0) {
          send({ step: 'error', message: 'AI 未提取到任何模块，请检查文档内容或更换模型后重试' })
          controller.close()
          return
        }

        await initPlansDir(basePath)
        const now = new Date().toISOString()

        if (result.project_name) {
          await writePlanProject(basePath, {
            schema_version: '1.0',
            name: result.project_name,
            description: result.project_description || '',
            tech_stack: [],
            created_at: now,
            updated_at: now,
          })
        }

        // Write modules
        const modules: ModulePlan[] = (result.modules || []).map((m: any) => ({
          module: m.module,
          slug: m.slug,
          layer: 'implementation' as const,
          status: 'pending' as const,
          depends_on: m.depends_on || [],
          decision_refs: [],
          overview: m.overview || '',
          priority: m.priority || 'medium',
          estimated_hours: null,
          created_at: now,
          updated_at: now,
          tasks: (m.tasks || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            status: 'pending' as const,
            depends_on: t.depends_on || [],
            detail: t.detail || '',
            files_to_create: t.files_to_create || [],
            files_to_modify: t.files_to_modify || [],
            acceptance_criteria: t.acceptance_criteria || [],
          })),
        }))

        for (const mod of modules) {
          send({ step: 'writing_module', slug: mod.slug, name: mod.module })
          await logConvert('info', traceId, 'Writing module', {
            moduleSlug: mod.slug,
            moduleName: mod.module,
            tasksCount: mod.tasks.length,
          })
          await writePlanModule(basePath, mod)
          await new Promise((r) => setTimeout(r, 200))
        }

        // Write decisions
        const decisions: Decision[] = (result.decisions || []).map((d: any) => ({
          decision_id: d.decision_id,
          question: d.question,
          context: d.context || '',
          options_presented: [],
          chosen: d.chosen,
          reason: d.reason,
          impact: [],
          affected_modules: d.affected_modules || [],
          decided_at: now,
          supersedes: null,
        }))

        for (const dec of decisions) {
          send({ step: 'writing_decision', id: dec.decision_id })
          await logConvert('info', traceId, 'Writing decision', {
            decisionId: dec.decision_id,
            affectedModulesCount: dec.affected_modules.length,
          })
          await writePlanDecision(basePath, dec)
        }

        await writePlanCache(basePath, 'convert-result', {
          timestamp: now,
          docsCount: body.docs.length,
          result,
        })

        await logConvert('info', traceId, 'Convert request completed', {
          modulesCount: modules.length,
          decisionsCount: decisions.length,
        })
        send({ step: 'done', modules: modules.length, decisions: decisions.length })
      } catch (e) {
        const message = e instanceof Error ? e.message : '服务器内部错误'
        await logConvert('error', traceId, 'Convert request failed', {
          error: message,
        })
        send({ step: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
