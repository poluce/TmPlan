import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GuidePhaseSlug, PhaseContext, ContextSummary } from '@/lib/ai/prompts'
import { dispatchProjectUpdated } from '@/lib/tmplan/client-events'

// ---- 类型定义 ----

export const GUIDE_PHASES: { slug: GuidePhaseSlug; label: string }[] = [
  { slug: 'concept', label: '概念' },
  { slug: 'features', label: '功能' },
  { slug: 'ui-pages', label: '页面' },
  { slug: 'tech-impl', label: '技术' },
]

export interface QuestionOption {
  id: string
  label: string
  description: string
}

export interface Question {
  id: string
  text: string
  type: 'single' | 'multi' | 'text'
  options?: QuestionOption[]
  recommendation?: string
}

export interface UserAnswer {
  questionId: string
  type: 'choice' | 'text'
  selectedOptions?: string[]
  textInput?: string
}

export interface GuideMessage {
  role: 'assistant' | 'user'
  content: string
  question?: Question
  answer?: UserAnswer
}

export interface TaskResult {
  id: string
  title: string
  detail: string
  depends_on: string[]
  files_to_create: string[]
  files_to_modify: string[]
  acceptance_criteria: string[]
}

export interface ModulePlanResult {
  module: string
  slug: string
  overview: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  layer?: 'feature' | 'implementation'
  depends_on: string[]
  tasks: TaskResult[]
}

export interface DecisionResult {
  decision_id: number
  question: string
  chosen: string
  reason: string
}

export interface PlanResult {
  projectName: string
  description: string
  techStack: string[]
  modules: ModulePlanResult[]
  decisions: DecisionResult[]
}

// Phase result types
export interface ConceptPhaseResult {
  phase: 'concept'
  project_name: string
  description: string
  target_users: string
  message: string
}

export interface FeaturesPhaseResult {
  phase: 'features'
  modules: Array<{ module: string; slug: string; overview: string }>
  message: string
}

export interface UiPagesPhaseResult {
  phase: 'ui-pages'
  pages: Array<{ module: string; slug: string; overview: string }>
  message: string
}

export interface TechImplPhaseResult {
  phase: 'tech-impl'
  tech_stack: string[]
  modules: ModulePlanResult[]
  decisions: DecisionResult[]
  message: string
}

export type PhaseResult = ConceptPhaseResult | FeaturesPhaseResult | UiPagesPhaseResult | TechImplPhaseResult

// AI config passed alongside requests
export interface AiConfig {
  apiKey: string
  baseUrl: string
  modelName: string
  modelType: string
}

// ---- Store ----

interface GuideState {
  projectPath: string | null
  sessionId: string | null
  messages: GuideMessage[]
  currentQuestion: Question | null
  isGenerating: boolean
  planResult: PlanResult | null
  error: string | null
  contextSummary: ContextSummary | null

  // Phase-based state
  currentPhase: GuidePhaseSlug
  phaseResults: PhaseResult[]
  pendingPhaseResult: PhaseResult | null

  startSession: (projectPath: string, userInput: string, aiConfig?: AiConfig) => Promise<void>
  answerQuestion: (answer: UserAnswer, aiConfig?: AiConfig) => Promise<void>
  confirmPhase: () => void
  reguidePhase: () => void
  savePlan: (projectPath: string) => Promise<boolean>
  reset: () => void
  retryLast: (aiConfig?: AiConfig) => Promise<void>
  clearForProject: (path: string) => void
  importPhaseResults: (results: PhaseResult[]) => void
}

export function getNextPhase(current: GuidePhaseSlug): GuidePhaseSlug | null {
  const order: GuidePhaseSlug[] = ['concept', 'features', 'ui-pages', 'tech-impl']
  const idx = order.indexOf(current)
  return idx < order.length - 1 ? order[idx + 1] : null
}

function buildPhaseContext(results: PhaseResult[]): PhaseContext {
  const ctx: PhaseContext = {}
  for (const r of results) {
    if (r.phase === 'concept') {
      ctx.concept = {
        projectName: r.project_name,
        description: r.description,
        targetUsers: r.target_users,
      }
    } else if (r.phase === 'features') {
      ctx.features = { modules: r.modules }
    } else if (r.phase === 'ui-pages') {
      ctx.uiPages = { pages: r.pages }
    }
  }
  return ctx
}

async function callGuideApi(
  body: Record<string, unknown>,
  aiConfig?: AiConfig
): Promise<{
  sessionId: string
  type: 'question' | 'result' | 'phase_result'
  question?: Question
  message?: string
  result?: PlanResult
  phaseResult?: Record<string, unknown>
  contextSummary?: ContextSummary
}> {
  const payload = aiConfig
    ? { ...body, apiKey: aiConfig.apiKey, baseUrl: aiConfig.baseUrl, modelName: aiConfig.modelName, modelType: aiConfig.modelType }
    : body

  const res = await fetch('/api/ai/guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function handleApiResponse(
  data: Awaited<ReturnType<typeof callGuideApi>>,
  prevMessages: GuideMessage[],
  set: (partial: Partial<GuideState>) => void
) {
  const assistantMsg: GuideMessage = {
    role: 'assistant',
    content: data.message || '',
    question: data.question,
  }

  const summaryUpdate: Partial<GuideState> = {}
  if (data.contextSummary) {
    summaryUpdate.contextSummary = data.contextSummary
  }

  if (data.type === 'phase_result' && data.phaseResult) {
    set({
      sessionId: data.sessionId,
      messages: [...prevMessages, assistantMsg],
      currentQuestion: null,
      pendingPhaseResult: data.phaseResult as unknown as PhaseResult,
      isGenerating: false,
      ...summaryUpdate,
    })
  } else {
    set({
      sessionId: data.sessionId,
      messages: [...prevMessages, assistantMsg],
      currentQuestion: data.question || null,
      planResult: data.type === 'result' ? data.result || null : null,
      isGenerating: false,
      ...summaryUpdate,
    })
  }
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
  projectPath: null,
  sessionId: null,
  messages: [],
  currentQuestion: null,
  isGenerating: false,
  planResult: null,
  error: null,
  contextSummary: null,
  currentPhase: 'concept' as GuidePhaseSlug,
  phaseResults: [],
  pendingPhaseResult: null,

  startSession: async (projectPath: string, userInput: string, aiConfig?: AiConfig) => {
    const { currentPhase, phaseResults } = get()
    const userMsg: GuideMessage = { role: 'user', content: userInput }

    set({
      projectPath,
      isGenerating: true,
      error: null,
      messages: [userMsg],
      currentQuestion: null,
      planResult: null,
      pendingPhaseResult: null,
    })

    try {
      const data = await callGuideApi(
        {
          projectPath,
          currentPhase,
          phaseContext: buildPhaseContext(phaseResults),
          userInput: { type: 'init', value: userInput },
          conversationHistory: [],
        },
        aiConfig
      )

      handleApiResponse(data, [userMsg], set)
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '未知错误',
        isGenerating: false,
      })
    }
  },

  answerQuestion: async (answer: UserAnswer, aiConfig?: AiConfig) => {
    const { sessionId, messages, currentPhase, phaseResults, contextSummary } = get()

    const userContent =
      answer.type === 'text'
        ? answer.textInput || ''
        : (answer.selectedOptions || []).join(', ')

    const userMsg: GuideMessage = {
      role: 'user',
      content: userContent,
      answer,
    }

    const updatedMessages = [...messages, userMsg]
    set({
      isGenerating: true,
      error: null,
      messages: updatedMessages,
      currentQuestion: null,
      pendingPhaseResult: null,
    })

    try {
      const data = await callGuideApi(
        {
          projectPath: '',
          sessionId,
          currentPhase,
          phaseContext: buildPhaseContext(phaseResults),
          userInput: {
            type: answer.type === 'text' ? 'text' : 'choice',
            selectedOptions: answer.selectedOptions,
            textInput: answer.textInput,
            questionId: answer.questionId,
          },
          conversationHistory: updatedMessages,
          contextSummary: contextSummary || undefined,
        },
        aiConfig
      )

      handleApiResponse(data, updatedMessages, set)
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '未知错误',
        isGenerating: false,
      })
    }
  },

  confirmPhase: () => {
    const { pendingPhaseResult, phaseResults, currentPhase } = get()
    if (!pendingPhaseResult) return

    const newResults = [...phaseResults, pendingPhaseResult]
    const nextPhase = getNextPhase(currentPhase)

    set({
      phaseResults: newResults,
      pendingPhaseResult: null,
      currentPhase: nextPhase || currentPhase,
      // Reset conversation for next phase
      messages: [],
      currentQuestion: null,
      sessionId: null,
      contextSummary: null,
    })
  },

  reguidePhase: () => {
    set({
      pendingPhaseResult: null,
      messages: [],
      currentQuestion: null,
      sessionId: null,
      error: null,
    })
  },

  savePlan: async (projectPath: string) => {
    const { phaseResults } = get()

    // Build a full plan from phase results
    let projectName = ''
    let description = ''
    let techStack: string[] = []
    const allModules: ModulePlanResult[] = []
    let decisions: DecisionResult[] = []

    for (const r of phaseResults) {
      if (r.phase === 'concept') {
        projectName = r.project_name
        description = r.description
      } else if (r.phase === 'features') {
        // Feature modules (no tasks)
        for (const m of r.modules) {
          allModules.push({
            module: m.module,
            slug: m.slug,
            overview: m.overview,
            depends_on: [],
            tasks: [],
          })
        }
      } else if (r.phase === 'ui-pages') {
        for (const p of r.pages) {
          allModules.push({
            module: p.module,
            slug: p.slug,
            overview: p.overview,
            depends_on: [],
            tasks: [],
          })
        }
      } else if (r.phase === 'tech-impl') {
        techStack = r.tech_stack
        for (const m of r.modules) {
          allModules.push(m)
        }
        decisions = r.decisions
      }
    }

    const planResult: PlanResult = {
      projectName,
      description,
      techStack,
      modules: allModules,
      decisions,
    }

    try {
      const { isTauri } = await import('@/lib/platform')
      if (isTauri()) {
        const da = await import('@/lib/tmplan/data-access')
        const { buildAiGuideImportMetadata } = await import('@/lib/tmplan/import-records')
        const tauriBridge = await import('@/lib/tmplan/tauri-bridge')
        const importId = `ai-guide_${Date.now()}_${crypto.randomUUID()}`
        // Write project config
        const now = new Date().toISOString()
        const [existingProject, existingModules, existingDecisions] = await Promise.all([
          da.readProject(projectPath).catch(() => null),
          da.readAllModules(projectPath).catch(() => []),
          da.readAllDecisions(projectPath).catch(() => []),
        ])
        const existingModulesBySlug = new Map(existingModules.map((module) => [module.slug, module]))
        const existingDecisionsById = new Map(existingDecisions.map((decision) => [decision.decision_id, decision]))
        await da.writeProject(projectPath, {
          schema_version: '1.0',
          name: planResult.projectName,
          description: planResult.description,
          tech_stack: planResult.techStack,
          created_at: existingProject?.created_at || now,
          updated_at: now,
        })
        // Write modules
        for (const m of planResult.modules) {
          const existingModule = existingModulesBySlug.get(m.slug)
          const existingTasksById = new Map(existingModule?.tasks.map((task) => [task.id, task]) ?? [])
          const layer = m.layer || (m.tasks.length > 0 ? 'implementation' : 'feature')
          await da.writeModule(projectPath, {
            module: m.module,
            slug: m.slug,
            layer,
            status: existingModule?.status ?? 'pending',
            depends_on: m.depends_on,
            decision_refs: [],
            overview: m.overview,
            priority: m.priority ?? 'medium',
            estimated_hours: null,
            created_at: existingModule?.created_at || now,
            updated_at: now,
            tasks: m.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: existingTasksById.get(t.id)?.status ?? 'pending',
              depends_on: t.depends_on,
              detail: t.detail,
              files_to_create: t.files_to_create,
              files_to_modify: t.files_to_modify,
              acceptance_criteria: t.acceptance_criteria,
            })),
          })
        }
        await tauriBridge.removeStaleModuleFiles(
          projectPath,
          planResult.modules.map((module) => module.slug)
        )
        // Write decisions
        for (const d of planResult.decisions) {
          const existingDecision = existingDecisionsById.get(d.decision_id)
          await da.writeDecision(projectPath, {
            decision_id: d.decision_id,
            question: d.question,
            context: '',
            options_presented: [],
            chosen: d.chosen,
            reason: d.reason,
            impact: [],
            affected_modules: [],
            decided_at: existingDecision?.decided_at || now,
            supersedes: null,
          })
        }
        await tauriBridge.removeStaleDecisionFiles(
          projectPath,
          planResult.decisions.map((decision) => ({
            decision_id: decision.decision_id,
            question: decision.question,
          }))
        )
        const { importRecord, fieldRecords } = buildAiGuideImportMetadata({
          importId,
          recordedAt: now,
          existingProject,
          existingModules,
          existingDecisions,
          planResult,
        })
        await da.appendImportMetadata(projectPath, importRecord, fieldRecords)
        dispatchProjectUpdated(projectPath)
        return true
      }
      // Web mode: use HTTP API
      const res = await fetch('/api/ai/guide/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, planResult }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '保存失败' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      dispatchProjectUpdated(projectPath)
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '保存失败' })
      return false
    }
  },

  reset: () =>
    set({
      projectPath: null,
      sessionId: null,
      messages: [],
      currentQuestion: null,
      isGenerating: false,
      planResult: null,
      error: null,
      contextSummary: null,
      currentPhase: 'concept',
      phaseResults: [],
      pendingPhaseResult: null,
    }),

  retryLast: async (aiConfig?: AiConfig) => {
    const { messages, sessionId, currentPhase, phaseResults, contextSummary, projectPath } = get()
    if (messages.length === 0) return

    set({ isGenerating: true, error: null })

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return

    if (messages.length === 1 && lastUserMsg.role === 'user') {
      // startSession retry
      try {
        const data = await callGuideApi(
          {
            projectPath,
            currentPhase,
            phaseContext: buildPhaseContext(phaseResults),
            userInput: { type: 'init', value: lastUserMsg.content },
            conversationHistory: [],
          },
          aiConfig
        )
        handleApiResponse(data, [lastUserMsg], set)
      } catch (e) {
        set({ error: e instanceof Error ? e.message : '未知错误', isGenerating: false })
      }
    } else if (lastUserMsg.answer) {
      // answerQuestion retry
      try {
        const answer = lastUserMsg.answer
        const data = await callGuideApi(
          {
            projectPath: '',
            sessionId,
            currentPhase,
            phaseContext: buildPhaseContext(phaseResults),
            userInput: {
              type: answer.type === 'text' ? 'text' : 'choice',
              selectedOptions: answer.selectedOptions,
              textInput: answer.textInput,
              questionId: answer.questionId,
            },
            conversationHistory: messages,
            contextSummary: contextSummary || undefined,
          },
          aiConfig
        )
        handleApiResponse(data, messages, set)
      } catch (e) {
        set({ error: e instanceof Error ? e.message : '未知错误', isGenerating: false })
      }
    }
  },

  importPhaseResults: (results: PhaseResult[]) => {
    const phaseOrder: GuidePhaseSlug[] = ['concept', 'features', 'ui-pages', 'tech-impl']
    let lastPhaseIdx = -1
    for (const r of results) {
      const idx = phaseOrder.indexOf(r.phase as GuidePhaseSlug)
      if (idx > lastPhaseIdx) lastPhaseIdx = idx
    }
    const nextPhase = lastPhaseIdx < phaseOrder.length - 1
      ? phaseOrder[lastPhaseIdx + 1]
      : phaseOrder[lastPhaseIdx]

    set({
      phaseResults: results,
      currentPhase: nextPhase,
      messages: [],
      currentQuestion: null,
      sessionId: null,
      pendingPhaseResult: null,
      contextSummary: null,
      error: null,
      isGenerating: false,
    })
  },

  clearForProject: (path: string) => {
    const { projectPath: stored } = get()
    if (stored && stored !== path) {
      get().reset()
    }
  },
    }),
    {
      name: 'tmplan-guide',
      version: 1,
      partialize: (state) => ({
        projectPath: state.projectPath,
        sessionId: state.sessionId,
        messages: state.messages,
        currentQuestion: state.currentQuestion,
        currentPhase: state.currentPhase,
        phaseResults: state.phaseResults,
        pendingPhaseResult: state.pendingPhaseResult,
        contextSummary: state.contextSummary,
      }),
    }
  )
)
