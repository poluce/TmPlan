/**
 * Tauri IPC bridge - wraps invoke() calls for all Rust commands.
 * Only imported when running inside Tauri.
 */
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  ProjectStatus,
} from '@/types/tmplan'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

// ---- File System Commands ----

export async function readProject(basePath: string): Promise<ProjectConfig> {
  return invoke<ProjectConfig>('read_project', { basePath })
}

export async function readAllModules(basePath: string): Promise<ModulePlan[]> {
  return invoke<ModulePlan[]>('read_all_modules', { basePath })
}

export async function readAllDecisions(basePath: string): Promise<Decision[]> {
  return invoke<Decision[]>('read_all_decisions', { basePath })
}

export async function readStatus(basePath: string): Promise<ProjectStatus> {
  return invoke<ProjectStatus>('read_status', { basePath })
}

export async function writeProject(basePath: string, data: ProjectConfig): Promise<void> {
  return invoke<void>('write_project', { basePath, data })
}

export async function writeModule(basePath: string, data: ModulePlan): Promise<void> {
  return invoke<void>('write_module', { basePath, data })
}

export async function writeDecision(basePath: string, data: Decision): Promise<void> {
  return invoke<void>('write_decision', { basePath, data })
}

export async function initTmplan(basePath: string): Promise<void> {
  return invoke<void>('init_tmplan', { basePath })
}

export async function checkTmplanExists(path: string): Promise<boolean> {
  return invoke<boolean>('check_tmplan_exists', { path })
}

// ---- Dialog Commands ----

export async function pickDirectory(): Promise<string | null> {
  return invoke<string | null>('pick_directory')
}

// ---- Shell Commands ----

export async function runGitCommand(projectPath: string, args: string[]): Promise<string> {
  return invoke<string>('run_git_command', { projectPath, args })
}

// ---- Progress Commands ----

export interface FileStatus {
  path: string
  exists: boolean
}

export interface ModuleProgress {
  slug: string
  total_files: number
  existing_files: number
  files: FileStatus[]
}

export interface ProjectProgress {
  total_files: number
  existing_files: number
  modules: ModuleProgress[]
}

export async function checkFileExists(projectPath: string, filePath: string): Promise<boolean> {
  return invoke<boolean>('check_file_exists', { projectPath, filePath })
}

export async function checkModuleProgress(
  projectPath: string,
  moduleData: unknown
): Promise<ModuleProgress> {
  return invoke<ModuleProgress>('check_module_progress', { projectPath, moduleData })
}

export async function checkProjectProgress(
  projectPath: string,
  modulesData: unknown[]
): Promise<ProjectProgress> {
  return invoke<ProjectProgress>('check_project_progress', { projectPath, modulesData })
}

// ---- Sidecar Commands ----

export async function startAiEngine(): Promise<string> {
  return invoke<string>('start_ai_engine')
}

export async function stopAiEngine(): Promise<void> {
  return invoke<void>('stop_ai_engine')
}

export async function getAiEngineStatus(): Promise<string> {
  return invoke<string>('get_ai_engine_status')
}
