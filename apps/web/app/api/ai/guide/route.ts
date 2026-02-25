import { NextRequest, NextResponse } from 'next/server'
import { buildPhaseSystemPrompt, GUIDE_FUNCTIONS, SUMMARIZER_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import type { GuidePhaseSlug, PhaseContext, ContextSummary } from '@/lib/ai/prompts'

interface GuideMessage {
  role: 'assistant' | 'user'
  content: string
}

interface RequestBody {
  projectPath: string
  sessionId?: string
  currentPhase?: GuidePhaseSlug
  phaseContext?: PhaseContext
  userInput: {
    type: 'init' | 'choice' | 'text'
    value?: string
    selectedOptions?: string[]
    textInput?: string
    questionId?: string
  }
  conversationHistory: GuideMessage[]
  contextSummary?: ContextSummary
  // AI config passed from client
  apiKey?: string
  baseUrl?: string
  modelName?: string
  modelType?: string
}

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

function buildMessages(body: RequestBody, contextSummary?: ContextSummary) {
  const phase = body.currentPhase || 'concept'
  const context = body.phaseContext || {}
  const systemPrompt = buildPhaseSystemPrompt(phase, context, contextSummary)

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // When we have a summary, trim already-summarized messages
  let history = body.conversationHistory
  if (contextSummary && contextSummary.questionsCovered > 0 && history.length > 0) {
    // messages[0] is init user msg, then each Q&A pair is 2 messages
    const coveredCount = 1 + contextSummary.questionsCovered * 2
    if (coveredCount < history.length) {
      history = history.slice(coveredCount)
    }
    // Safety: keep at least 2 recent messages
    if (history.length < 2 && body.conversationHistory.length >= 2) {
      history = body.conversationHistory.slice(-2)
    }
  }

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content })
  }

  if (body.userInput.type === 'init' && body.userInput.value) {
    messages.push({ role: 'user', content: body.userInput.value })
  }

  return messages
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

// ---- Retry with exponential backoff for rate-limit (429) ----
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429 || attempt === maxRetries) return res

    // Use Retry-After header if available, otherwise exponential backoff
    const retryAfter = res.headers.get('retry-after')
    const waitMs = retryAfter
      ? Math.min(parseInt(retryAfter, 10) * 1000, 30000)
      : Math.min(1000 * Math.pow(2, attempt), 15000)

    await new Promise((r) => setTimeout(r, waitMs))
  }
  // Should not reach here, but just in case
  throw lastError || new Error('请求过于频繁，重试后仍然失败')
}

async function callOpenAICompatible(
  config: ReturnType<typeof getApiConfig>,
  messages: Array<{ role: string; content: string }>,
  options?: { skipTools?: boolean; maxTokens?: number }
) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const requestBody: Record<string, unknown> = {
    model: config.modelName,
    messages,
    max_tokens: options?.maxTokens ?? 4096,
  }

  if (!options?.skipTools) {
    requestBody.tools = GUIDE_FUNCTIONS.map((f) => ({
      type: 'function',
      function: { name: f.name, description: f.description, parameters: f.parameters },
    }))
    requestBody.tool_choice = 'auto'
  }

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
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
  options?: { skipTools?: boolean; maxTokens?: number }
) {
  const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const claudeUrl = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`

  const requestBody: Record<string, unknown> = {
    model: config.modelName,
    max_tokens: options?.maxTokens ?? 4096,
    system: systemMsg,
    messages: chatMessages,
  }

  if (!options?.skipTools) {
    requestBody.tools = GUIDE_FUNCTIONS.map((f) => ({
      name: f.name,
      description: f.description,
      input_schema: f.parameters,
    }))
  }

  const res = await fetchWithRetry(claudeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(parseApiError(res.status, err))
  }

  const data = await res.json()

  // Normalize Claude response to OpenAI format
  const toolUse = data.content?.find((b: { type: string }) => b.type === 'tool_use')
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')

  if (toolUse) {
    return {
      choices: [
        {
          message: {
            content: textBlock?.text || null,
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

  return {
    choices: [
      {
        message: {
          content: textBlock?.text || data.content?.[0]?.text || '',
          tool_calls: null,
        },
      },
    ],
  }
}

// ---- Context summarization helpers ----

function countQAPairs(history: GuideMessage[]): number {
  // messages[0] is init user msg, then assistant→user pairs
  let count = 0
  for (let i = 1; i < history.length - 1; i += 2) {
    if (history[i].role === 'assistant' && history[i + 1]?.role === 'user') {
      count++
    }
  }
  return count
}

function shouldSummarize(history: GuideMessage[], existingSummary?: ContextSummary): boolean {
  const totalPairs = countQAPairs(history)
  const alreadyCovered = existingSummary?.questionsCovered ?? 0
  return totalPairs - alreadyCovered >= 3
}

async function summarizeConversation(
  config: ReturnType<typeof getApiConfig>,
  history: GuideMessage[],
  existingSummary?: ContextSummary
): Promise<ContextSummary | null> {
  try {
    const totalPairs = countQAPairs(history)

    let userContent = '以下是对话历史：\n\n'
    for (const msg of history) {
      userContent += `[${msg.role === 'assistant' ? 'AI' : '用户'}]: ${msg.content}\n\n`
    }
    if (existingSummary) {
      userContent += `\n之前的摘要：\n${JSON.stringify(existingSummary, null, 2)}\n\n请合并新信息，输出更新后的完整摘要。`
    }

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]

    const aiResponse =
      config.modelType === 'claude'
        ? await callClaude(config, messages, { skipTools: true, maxTokens: 1024 })
        : await callOpenAICompatible(config, messages, { skipTools: true, maxTokens: 1024 })

    const content = aiResponse.choices?.[0]?.message?.content
    if (!content) return null

    // Extract JSON from response (handle possible markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      questionsCovered: totalPairs,
    }
  } catch {
    // Summarization failed — fall back silently
    return null
  }
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

    const config = getApiConfig(body)

    if (!config.modelName) {
      return NextResponse.json(
        { error: '请先在设置中选择或填写模型名称' },
        { status: 400 }
      )
    }

    if (!config.modelType) {
      return NextResponse.json(
        { error: '请先在设置中选择模型类型' },
        { status: 400 }
      )
    }

    // ---- Summarization step ----
    let contextSummary: ContextSummary | undefined = body.contextSummary ?? undefined

    if (body.conversationHistory.length > 0 && shouldSummarize(body.conversationHistory, contextSummary)) {
      const newSummary = await summarizeConversation(config, body.conversationHistory, contextSummary)
      if (newSummary) {
        contextSummary = newSummary
      }
    }

    const messages = buildMessages(body, contextSummary)

    const sessionId =
      body.sessionId || `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Call AI
    const aiResponse =
      config.modelType === 'claude'
        ? await callClaude(config, messages)
        : await callOpenAICompatible(config, messages)

    const choice = aiResponse.choices?.[0]?.message
    if (!choice) {
      return NextResponse.json({ error: 'AI 返回为空' }, { status: 502 })
    }

    // Parse function call
    const toolCall = choice.tool_calls?.[0]
    if (toolCall) {
      const fnName = toolCall.function.name
      const fnArgs = JSON.parse(toolCall.function.arguments)

      if (fnName === 'ask_question') {
        return NextResponse.json({
          sessionId,
          type: 'question',
          message: fnArgs.message || '',
          question: {
            id: fnArgs.question_id,
            text: fnArgs.text,
            type: fnArgs.type,
            options: fnArgs.options || [],
            recommendation: fnArgs.recommendation,
          },
          contextSummary: contextSummary || undefined,
        })
      }

      if (fnName === 'confirm_phase') {
        return NextResponse.json({
          sessionId,
          type: 'phase_result',
          message: fnArgs.message || '',
          phaseResult: fnArgs,
          contextSummary: contextSummary || undefined,
        })
      }

      // Legacy support for generate_plan
      if (fnName === 'generate_plan') {
        return NextResponse.json({
          sessionId,
          type: 'result',
          message: fnArgs.message || '',
          result: {
            projectName: fnArgs.project_name,
            description: fnArgs.description,
            techStack: fnArgs.tech_stack,
            modules: fnArgs.modules.map(
              (m: {
                module: string
                slug: string
                overview: string
                priority?: string
                depends_on: string[]
                tasks: Array<{
                  id: string
                  title: string
                  detail: string
                  depends_on: string[]
                  files_to_create: string[]
                  files_to_modify: string[]
                  acceptance_criteria: string[]
                }>
              }) => ({
                module: m.module,
                slug: m.slug,
                overview: m.overview,
                priority: m.priority || 'medium',
                depends_on: m.depends_on,
                tasks: (m.tasks || []).map((t) => ({
                  id: t.id,
                  title: t.title,
                  detail: t.detail,
                  depends_on: t.depends_on || [],
                  files_to_create: t.files_to_create || [],
                  files_to_modify: t.files_to_modify || [],
                  acceptance_criteria: t.acceptance_criteria || [],
                })),
              })
            ),
            decisions: fnArgs.decisions,
          },
          contextSummary: contextSummary || undefined,
        })
      }
    }

    // Fallback: AI returned plain text without function call
    return NextResponse.json({
      sessionId,
      type: 'question',
      message: choice.content || 'AI 未返回结构化数据，请重试。',
      question: null,
      contextSummary: contextSummary || undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '服务器内部错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
