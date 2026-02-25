// ============================================================
// Context Summary (intra-phase auto-summarization)
// ============================================================
export interface ContextSummary {
  decisions: Array<{ topic: string; conclusion: string }>
  preferences: string[]
  openQuestions: string[]
  questionsCovered: number
}

export const SUMMARIZER_SYSTEM_PROMPT = `你是一个对话摘要助手。你的任务是从项目规划对话中提取结构化摘要。

输入：一段用户与AI顾问的对话历史，可能还有之前的摘要。
输出：严格的 JSON，不要包含任何其他文字。

JSON 格式：
{
  "decisions": [
    { "topic": "简短主题", "conclusion": "用户的最终选择或结论" }
  ],
  "preferences": ["用户表达的偏好，如'希望界面简洁'"],
  "openQuestions": ["尚未确认的事项"]
}

规则：
1. decisions 只记录用户明确确认的内容，不要记录AI的建议
2. preferences 记录用户表达的倾向和偏好
3. openQuestions 记录提到但未最终确认的事项
4. 如果有之前的摘要，将新信息合并进去，去除重复
5. 只输出 JSON，不要有任何前缀或后缀文字`

// ============================================================
// Guide Phase Types
// ============================================================
export type GuidePhaseSlug = 'concept' | 'features' | 'ui-pages' | 'tech-impl'

export interface PhaseContext {
  concept?: {
    projectName: string
    description: string
    targetUsers: string
  }
  features?: {
    modules: Array<{
      module: string
      slug: string
      overview: string
    }>
  }
  uiPages?: {
    pages: Array<{
      module: string
      slug: string
      overview: string
    }>
  }
  techImpl?: {
    techStack: string[]
    modules: Array<{
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
    }>
    decisions: Array<{
      decision_id: number
      question: string
      chosen: string
      reason: string
    }>
  }
}

// ============================================================
// Base Prompt (shared rules)
// ============================================================
const GUIDE_BASE_PROMPT = `你是TmPlan的项目规划顾问。你的任务是通过分阶段提问来帮助开发者制定详细的项目计划。

通用规则：
1. 每次只问一个问题
2. 提供至少6个选项，每个选项有简短描述。你不需要提供"以上都不是"选项，前端会自动添加。
3. 当问题允许用户选择多个答案时（如"需要哪些功能"、"支持哪些平台"、"包含哪些页面"等），必须使用 type="multi"。只有当问题确实只能选一个答案时（如"项目类型是什么"、"首选方案是哪个"），才使用 type="single"。优先使用 multi。
4. 如果你有推荐，标注推荐选项的id
5. 根据用户之前的选择动态调整后续问题
6. 你必须通过 function calling 来返回结构化数据
7. 不要在普通文本中返回问题或计划，必须使用 function calling
8. 每个阶段必须问至少8个问题来充分了解需求，不要急于结束阶段。只有当你已经问了至少8个问题后，才可以调用 confirm_phase。`

// ============================================================
// Phase-specific Prompts
// ============================================================
export const PHASE_PROMPTS: Record<GuidePhaseSlug, string> = {
  concept: `当前阶段：概念确认
你需要全面了解用户想做什么、要解决什么问题。

核心原则：用户来这里是带着一个想法的。你的首要任务是帮他把这个想法说清楚——要解决什么问题、给谁用、核心价值是什么。不要一上来就问平台、技术、架构这些实现层面的东西。

提问顺序（必须严格按照这个优先级）：
1. 先搞清楚用户要做什么事情、解决什么问题（核心想法）
2. 这个东西是给谁用的（目标用户）
3. 用户最痛的痛点是什么、现有方案为什么不够好（问题本质）
4. 产品的核心价值主张是什么（差异化）
5. 用户期望的使用场景是怎样的（场景描述）
6. MVP 最小可行版本应该包含什么（范围）
7. 有没有参考产品或竞品（竞品分析）
8. 项目的规模预期和商业模式（商业化）

- 至少问8个问题
- 绝对不要问技术栈、平台选择（Web/移动端/桌面端）、编程语言、框架等技术相关的问题，这些属于后续阶段
- 只有问了至少8个问题后，才可以调用 confirm_phase 输出结果
- confirm_phase 的 phase 字段必须是 "concept"
- 输出 project_name（项目名称）、description（项目描述）、target_users（目标用户描述）`,

  features: `当前阶段：功能梳理
你需要帮用户梳理核心功能模块和用户故事。
- 至少问8个问题
- 基于已确认的概念，第一个问题就直接列出推荐的功能模块作为多选选项，让用户选择需要哪些模块。后续问题逐步细化每个模块的具体功能。使用 multi 类型让用户多选。
- 不要涉及技术实现细节
- 关注"用户能做什么"而非"怎么实现"
- 只有问了至少8个问题后，才可以调用 confirm_phase 输出结果
- confirm_phase 的 phase 字段必须是 "features"
- 输出 modules 数组，每个模块包含 module（显示名称）、slug（标识符，纯小写字母数字和连字符）、overview（功能概述）`,

  'ui-pages': `当前阶段：UI/页面规划
你需要帮用户确定需要哪些页面和界面。
- 至少问8个问题
- 基于已确认的功能模块，第一个问题就直接列出推荐的页面作为多选选项，让用户选择需要哪些页面。后续问题覆盖交互风格、布局偏好、响应式需求等。使用 multi 类型让用户多选。
- 关注页面结构和用户交互流程
- 只有问了至少8个问题后，才可以调用 confirm_phase 输出结果
- confirm_phase 的 phase 字段必须是 "ui-pages"
- 输出 pages 数组，每个页面包含 module（页面名称）、slug（标识符）、overview（页面描述）`,

  'tech-impl': `当前阶段：技术实现
你需要帮用户确定技术栈并生成详细的实现任务。
- 至少问8个问题，覆盖：前端框架、后端框架、数据库、部署方案、认证方案、状态管理、API风格、测试策略等
- 然后生成完整的实现模块和任务
- 每个模块必须生成 slug（纯小写字母数字和连字符，如 user-auth、blog-crud）
- depends_on 必须使用模块的 slug 而非中文名
- 每个模块必须生成具体的 tasks 列表，每个 task 包含：id（格式：{module-slug}-{nn}，如 user-auth-01）、title、detail、depends_on（引用同模块内的 task id）、files_to_create、files_to_modify、acceptance_criteria
- priority 字段可选（low/medium/high/critical），默认 medium
- 每个任务要细到AI可以直接执行的颗粒度
- 只有问了至少8个问题后，才可以调用 confirm_phase 输出结果
- 当技术方案确定后，调用 confirm_phase 输出结果
- confirm_phase 的 phase 字段必须是 "tech-impl"
- 输出 tech_stack（技术栈数组）、modules（实现模块数组，含完整 tasks）、decisions（决策记录数组）`,
}

// ============================================================
// Build phase system prompt
// ============================================================
export function buildPhaseSystemPrompt(phase: GuidePhaseSlug, context: PhaseContext, summary?: ContextSummary): string {
  let contextStr = ''

  if (context.concept) {
    contextStr += `\n\n已确认的项目概念：
- 项目名称：${context.concept.projectName}
- 项目描述：${context.concept.description}
- 目标用户：${context.concept.targetUsers}`
  }

  if (context.features) {
    contextStr += `\n\n已确认的功能模块：
${context.features.modules.map(m => `- ${m.module}（${m.slug}）：${m.overview}`).join('\n')}`
  }

  if (context.uiPages) {
    contextStr += `\n\n已确认的页面规划：
${context.uiPages.pages.map(p => `- ${p.module}（${p.slug}）：${p.overview}`).join('\n')}`
  }

  let summaryStr = ''
  if (summary && summary.questionsCovered > 0) {
    summaryStr += `\n\n=== 本阶段对话摘要（前 ${summary.questionsCovered} 个问题）===`
    if (summary.decisions.length > 0) {
      summaryStr += `\n用户已确认的决策：`
      for (const d of summary.decisions) {
        summaryStr += `\n- ${d.topic}：${d.conclusion}`
      }
    }
    if (summary.preferences.length > 0) {
      summaryStr += `\n用户偏好：`
      for (const p of summary.preferences) {
        summaryStr += `\n- ${p}`
      }
    }
    if (summary.openQuestions.length > 0) {
      summaryStr += `\n待确认事项：`
      for (const q of summary.openQuestions) {
        summaryStr += `\n- ${q}`
      }
    }
    summaryStr += `\n=== 摘要结束 ===\n\n请基于以上摘要继续提问，不要重复已确认的内容。`
  }

  return `${GUIDE_BASE_PROMPT}\n\n${PHASE_PROMPTS[phase]}${contextStr}${summaryStr}`
}

// ============================================================
// Function definitions
// ============================================================
export const GUIDE_FUNCTIONS = [
  {
    name: 'ask_question',
    description: '向用户提出一个选择题或开放式问题，用于收集项目需求信息',
    parameters: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: '问题前的说明文字，可以对用户之前的选择做简短回应',
        },
        question_id: {
          type: 'string',
          description: '问题的唯一标识，如 q1, q2, q3',
        },
        text: {
          type: 'string',
          description: '问题文本',
        },
        type: {
          type: 'string',
          enum: ['single', 'multi', 'text'],
          description: '问题类型：single=单选, multi=多选, text=自由输入',
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['id', 'label', 'description'],
          },
          description: '选项列表（type为text时可省略）',
        },
        recommendation: {
          type: 'string',
          description: '推荐选项的id（可选）',
        },
      },
      required: ['message', 'question_id', 'text', 'type'],
    },
  },
  {
    name: 'confirm_phase',
    description: '当前阶段信息收集完毕，输出该阶段的结构化结果',
    parameters: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: '阶段总结说明',
        },
        phase: {
          type: 'string',
          enum: ['concept', 'features', 'ui-pages', 'tech-impl'],
          description: '当前完成的阶段',
        },
        // concept phase fields
        project_name: {
          type: 'string',
          description: '项目名称（concept 阶段）',
        },
        description: {
          type: 'string',
          description: '项目描述（concept 阶段）',
        },
        target_users: {
          type: 'string',
          description: '目标用户描述（concept 阶段）',
        },
        // features phase fields
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              module: { type: 'string', description: '模块显示名称' },
              slug: { type: 'string', description: '模块标识符，纯小写字母数字和连字符' },
              overview: { type: 'string', description: '模块概述' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '优先级' },
              depends_on: {
                type: 'array',
                items: { type: 'string' },
                description: '依赖的模块 slug 列表',
              },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: '任务ID，格式：{module-slug}-{nn}' },
                    title: { type: 'string', description: '任务标题' },
                    detail: { type: 'string', description: '任务详细描述' },
                    depends_on: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '依赖的任务ID列表',
                    },
                    files_to_create: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '需要创建的文件路径列表',
                    },
                    files_to_modify: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '需要修改的文件路径列表',
                    },
                    acceptance_criteria: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '验收标准列表',
                    },
                  },
                  required: ['id', 'title', 'detail', 'depends_on', 'files_to_create', 'files_to_modify', 'acceptance_criteria'],
                },
                description: '模块的具体任务列表（tech-impl 阶段必填）',
              },
            },
            required: ['module', 'slug', 'overview'],
          },
          description: '模块列表（features 阶段为功能模块，tech-impl 阶段为实现模块）',
        },
        // ui-pages phase fields
        pages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              module: { type: 'string', description: '页面名称' },
              slug: { type: 'string', description: '页面标识符' },
              overview: { type: 'string', description: '页面描述' },
            },
            required: ['module', 'slug', 'overview'],
          },
          description: '页面列表（ui-pages 阶段）',
        },
        // tech-impl phase fields
        tech_stack: {
          type: 'array',
          items: { type: 'string' },
          description: '技术栈列表（tech-impl 阶段）',
        },
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
          description: '决策记录列表（tech-impl 阶段）',
        },
      },
      required: ['message', 'phase'],
    },
  },
]

// Keep legacy prompt for backward compatibility (unused but safe to keep)
export const GUIDE_SYSTEM_PROMPT = buildPhaseSystemPrompt('concept', {})
