/**
 * Unified data access layer.
 * Automatically selects Tauri IPC or HTTP fetch based on runtime environment.
 */
import { isTauri } from '@/lib/platform'
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  ProjectStatus,
  TaskStatus,
} from '@/types/tmplan'
import type {
  FieldSourceRegistry,
  FieldSourceRecord,
  ImportManifest,
  ImportRecord,
} from '@/types/tmplan-imports'
import type { PPFEvent, EventQuery } from '@/types/event-sourcing'
import { generatePPFId, type PPFModule, type PPFProject } from '@/types/ppf'

// Lazy-load tauri bridge to avoid import errors in web mode
async function bridge() {
  return import('./tauri-bridge')
}

// ---- HTTP helpers (web mode) ----

async function httpGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function httpPost<T>(url: string, body: unknown, traceId?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(traceId ? { 'x-trace-id': traceId } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function httpPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function plansUrl(projectPath: string, ...segments: string[]): string {
  const base = `/api/plans/${encodeURIComponent(projectPath)}`
  return segments.length > 0 ? `${base}/${segments.join('/')}` : base
}

function toPpfProjectForMarkdownExport(project: ProjectConfig): PPFProject {
  return {
    ...project,
    schema_version: '2.0',
    ppf_id: (project as Record<string, unknown>).ppf_id as string ?? 'ppf_project_temp',
    extensions: {},
    plan_version: 1,
    plan_status: 'active',
    metadata: {
      target_users: [],
      ui_pages: [],
      source: '',
      tags: [],
    },
    modules: [],
    decisions: [],
    phases: [],
  }
}

function toPpfModulesForMarkdownExport(modules: ModulePlan[]): PPFModule[] {
  return modules.map((module) => ({
    ...module,
    ppf_id: generatePPFId(),
    extensions: {},
    tags: [],
    source: '',
    tasks: module.tasks.map((task) => ({
      ...task,
      ppf_id: generatePPFId(),
      extensions: {},
      assignee: '',
      tags: [],
      due_date: null,
    })),
  }))
}

// ---- Public API ----

export async function readProject(projectPath: string): Promise<ProjectConfig> {
  if (isTauri()) {
    const b = await bridge()
    return b.readProject(projectPath)
  }
  return httpGet<ProjectConfig>(plansUrl(projectPath))
}

export async function readAllModules(projectPath: string): Promise<ModulePlan[]> {
  if (isTauri()) {
    const b = await bridge()
    return b.readAllModules(projectPath)
  }
  return httpGet<ModulePlan[]>(plansUrl(projectPath, 'modules'))
}

export async function readAllDecisions(projectPath: string): Promise<Decision[]> {
  if (isTauri()) {
    const b = await bridge()
    return b.readAllDecisions(projectPath)
  }
  return httpGet<Decision[]>(plansUrl(projectPath, 'decisions'))
}

export async function readStatus(projectPath: string): Promise<ProjectStatus> {
  if (isTauri()) {
    const b = await bridge()
    return b.readStatus(projectPath)
  }
  return httpGet<ProjectStatus>(plansUrl(projectPath, 'status'))
}

export async function writeProject(projectPath: string, data: ProjectConfig): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.writeProject(projectPath, data)
  }
  await httpPost(plansUrl(projectPath), data)
}

export async function writeModule(projectPath: string, data: ModulePlan): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.writeModule(projectPath, data)
  }
  await httpPost(plansUrl(projectPath, 'modules'), data)
}

export async function writeDecision(projectPath: string, data: Decision): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.writeDecision(projectPath, data)
  }
  await httpPost(plansUrl(projectPath, 'decisions'), data)
}

export async function initProject(projectPath: string): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.initTmplan(projectPath)
  }
  await httpPost(plansUrl(projectPath, 'init'), {})
}

export async function checkTmplanExists(projectPath: string): Promise<boolean> {
  if (isTauri()) {
    const b = await bridge()
    return b.checkTmplanExists(projectPath)
  }
  // Web mode: try reading project config, if it fails, .tmplan doesn't exist
  try {
    await httpGet(plansUrl(projectPath))
    return true
  } catch {
    return false
  }
}

export type { FileStatus, ModuleProgress, ProjectProgress } from './tauri-bridge'

// ---- Docs ----

export interface DocFile {
  path: string
  name: string
  content: string
}

export async function readDocs(
  projectPath: string,
  relativePaths: string[]
): Promise<DocFile[]> {
  if (relativePaths.length === 0) return []
  // TODO: Tauri mode support
  const url = `${plansUrl(projectPath, 'docs')}?paths=${encodeURIComponent(relativePaths.join(','))}`
  const data = await httpGet<{ files: DocFile[] }>(url)
  return data.files
}

export async function readImportMetadata(
  projectPath: string
): Promise<{ manifest: ImportManifest; fieldSources: FieldSourceRegistry }> {
  if (isTauri()) {
    const b = await bridge()
    return b.readImportMetadata(projectPath)
  }

  return httpGet<{ manifest: ImportManifest; fieldSources: FieldSourceRegistry }>(
    plansUrl(projectPath, 'imports')
  )
}

export async function appendImportMetadata(
  projectPath: string,
  record: ImportRecord,
  fieldRecords: FieldSourceRecord[]
): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.appendImportMetadata(projectPath, record, fieldRecords)
  }

  await httpPost(plansUrl(projectPath, 'imports'), {
    record,
    fieldRecords,
  })
}

// ---- 文档转换 ----

export interface ConvertDocsResult {
  success: boolean
  modules: number
  decisions: number
}

export interface AiConfig {
  apiKey: string
  baseUrl: string
  modelName: string
  modelType: string
  traceId?: string
}

export async function convertDocs(
  projectPath: string,
  docs: DocFile[],
  aiConfig: AiConfig
): Promise<ConvertDocsResult> {
  return httpPost<ConvertDocsResult>(
    plansUrl(projectPath, 'convert'),
    { docs, ...aiConfig },
    aiConfig.traceId
  )
}

// ---- SSE 流式转换 ----

export interface ConvertProgress {
  docStatus: Record<string, 'pending' | 'reading' | 'done'>
  overall: 'idle' | 'reading' | 'analyzing' | 'writing' | 'done' | 'error'
  message: string
}

export type ConvertStreamEvent =
  | { step: 'reading'; doc: string }
  | { step: 'analyzing'; docsCount: number }
  | { step: 'writing_module'; slug: string; name: string }
  | { step: 'writing_decision'; id: number }
  | { step: 'done'; modules: number; decisions: number }
  | { step: 'error'; message: string }

export async function convertDocsStream(
  projectPath: string,
  docs: DocFile[],
  aiConfig: AiConfig,
  onProgress: (event: ConvertStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(plansUrl(projectPath, 'convert'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(aiConfig.traceId ? { 'x-trace-id': aiConfig.traceId } : {}),
    },
    body: JSON.stringify({ docs, ...aiConfig }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          onProgress(JSON.parse(line.slice(6)))
        } catch { /* ignore parse errors */ }
      }
    }
  }

  if (buffer.startsWith('data: ')) {
    try {
      onProgress(JSON.parse(buffer.slice(6)))
    } catch { /* ignore */ }
  }
}

// ---- PPF 2.0: 任务状态持久化 ----

export async function persistTaskStatus(
  projectPath: string,
  moduleSlug: string,
  taskId: string,
  status: TaskStatus
): Promise<void> {
  if (isTauri()) {
    const b = await bridge()
    return b.updateTaskStatus(projectPath, moduleSlug, taskId, status)
  }
  await httpPut(plansUrl(projectPath, 'tasks', 'status'), {
    moduleSlug,
    taskId,
    status,
  })
}

// ---- PPF 2.0: 事件查询 ----

export async function queryEvents(
  projectPath: string,
  query?: Partial<EventQuery>
): Promise<PPFEvent[]> {
  if (isTauri()) {
    const b = await bridge()
    return b.queryEvents(projectPath, query)
  }
  const params = new URLSearchParams()
  if (query?.from_date) params.set('from_date', query.from_date)
  if (query?.to_date) params.set('to_date', query.to_date)
  if (query?.type) params.set('type', query.type)
  if (query?.limit) params.set('limit', String(query.limit))
  if (query?.offset) params.set('offset', String(query.offset))

  const qs = params.toString()
  const url = plansUrl(projectPath, 'events') + (qs ? `?${qs}` : '')
  const data = await httpGet<{ events: PPFEvent[] }>(url)
  return data.events
}

// ---- PPF 2.0: Markdown 带锚点导出 ----

export async function exportMarkdownWithAnchors(
  projectPath: string
): Promise<string> {
  if (isTauri()) {
    const [{ renderProjectToMarkdown }, project, modules] = await Promise.all([
      import('@/lib/ppf/markdown-renderer'),
      readProject(projectPath),
      readAllModules(projectPath),
    ])
    return renderProjectToMarkdown(
      toPpfProjectForMarkdownExport(project),
      toPpfModulesForMarkdownExport(modules)
    )
  }
  const data = await httpGet<{ markdown: string }>(
    plansUrl(projectPath, 'markdown')
  )
  return data.markdown
}

// ---- PPF 2.0: Markdown AST 导入 ----

export interface MarkdownImportResult {
  project: Record<string, unknown>
  modules: ReadonlyArray<{
    ppf_id: string | null
    module: string
    slug: string
    status: string
    priority: string
    depends_on: readonly string[]
    overview: string
    tasks: ReadonlyArray<{
      ppf_id: string | null
      id: string
      title: string
      status: string
    }>
  }>
  anchorsFound: number
  newContentCount: number
  unmatchedContent: readonly string[]
}

export async function importMarkdownAST(
  projectPath: string,
  markdown: string
): Promise<MarkdownImportResult> {
  if (isTauri()) {
    void projectPath
    const { parseMarkdownToPPF } = await import('@/lib/ppf/markdown-parser')
    return parseMarkdownToPPF(markdown)
  }
  return httpPost<MarkdownImportResult>(
    plansUrl(projectPath, 'markdown'),
    { markdown }
  )
}
