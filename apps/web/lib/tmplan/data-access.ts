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
} from '@/types/tmplan'

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

async function httpPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
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
