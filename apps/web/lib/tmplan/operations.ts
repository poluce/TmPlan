import { readAllModules, readStatus } from './reader'
import { writeModule, updateStatus } from './writer'
import { calculateProgress } from './utils'
import { validateModuleDependencies, detectCyclicDependencies } from './validator'
import { unlink } from 'fs/promises'
import { join } from 'path'
import type { ModulePlan, ProjectStatus, TaskStatus } from '@/types/tmplan'

const TMPLAN_DIR = '.tmplan'

function tmplanPath(basePath: string, ...segments: string[]): string {
  return join(basePath, TMPLAN_DIR, ...segments)
}

function deriveModuleStatus(mod: ModulePlan): ModulePlan['status'] {
  if (mod.tasks.length === 0) return mod.status
  const allCompleted = mod.tasks.every((t) => t.status === 'completed')
  if (allCompleted) return 'completed'
  const anyStarted = mod.tasks.some(
    (t) => t.status === 'in_progress' || t.status === 'completed'
  )
  if (anyStarted) return 'in_progress'
  return 'pending'
}

export async function addModule(
  basePath: string,
  plan: ModulePlan
): Promise<void> {
  const modules = await readAllModules(basePath)
  const updated = [...modules, plan]

  const depErrors = validateModuleDependencies(updated)
  if (depErrors.length > 0) {
    throw new Error(`依赖校验失败:\n${depErrors.join('\n')}`)
  }

  const cyclic = detectCyclicDependencies(updated)
  if (cyclic) {
    throw new Error(`检测到循环依赖: ${cyclic.join(', ')}`)
  }

  await writeModule(basePath, plan)
  await syncStatus(basePath)
}

export async function removeModule(
  basePath: string,
  slug: string
): Promise<void> {
  const modules = await readAllModules(basePath)
  const referencing = modules.filter(
    (m) => m.slug !== slug && m.depends_on.includes(slug)
  )
  if (referencing.length > 0) {
    const names = referencing.map((m) => m.slug).join(', ')
    throw new Error(`无法删除模块 "${slug}"，以下模块依赖它: ${names}`)
  }

  const filePath = tmplanPath(basePath, 'modules', `${slug}.yaml`)
  await unlink(filePath)
  await syncStatus(basePath)
}

export async function changeTaskStatus(
  basePath: string,
  moduleSlug: string,
  taskId: string,
  status: TaskStatus
): Promise<void> {
  const modules = await readAllModules(basePath)
  const mod = modules.find((m) => m.slug === moduleSlug)
  if (!mod) {
    throw new Error(`模块 "${moduleSlug}" 不存在`)
  }

  const task = mod.tasks.find((t) => t.id === taskId)
  if (!task) {
    throw new Error(`任务 "${taskId}" 在模块 "${moduleSlug}" 中不存在`)
  }

  task.status = status
  mod.status = deriveModuleStatus(mod)
  mod.updated_at = new Date().toISOString()

  await writeModule(basePath, mod)
  await syncStatus(basePath)
}

export async function syncStatus(basePath: string): Promise<ProjectStatus> {
  const modules = await readAllModules(basePath)

  let currentStatus: ProjectStatus
  try {
    currentStatus = await readStatus(basePath)
  } catch {
    const now = new Date().toISOString()
    currentStatus = {
      overall_progress: 0,
      current_phase: '',
      modules_status: {},
      last_check_at: now,
      updated_at: now,
      conflicts: [],
    }
  }

  const modulesStatus: Record<string, 'pending' | 'in_progress' | 'completed'> = {}
  for (const mod of modules) {
    modulesStatus[mod.slug] = deriveModuleStatus(mod)
  }

  const now = new Date().toISOString()
  const updated: ProjectStatus = {
    ...currentStatus,
    overall_progress: calculateProgress(modules),
    modules_status: modulesStatus,
    last_check_at: now,
    updated_at: now,
  }

  await updateStatus(basePath, updated)
  return updated
}
