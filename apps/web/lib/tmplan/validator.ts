import type { ModulePlan, ModuleTask } from '@/types/tmplan'

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug)
}

export function validateModuleDependencies(modules: ModulePlan[]): string[] {
  const slugs = new Set(modules.map(m => m.slug))
  const errors: string[] = []
  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      if (!slugs.has(dep)) {
        errors.push(`模块 "${mod.slug}" 依赖的模块 "${dep}" 不存在`)
      }
    }
  }
  return errors
}

export function validateTaskDependencies(mod: ModulePlan): string[] {
  const taskIds = new Set(mod.tasks.map(t => t.id))
  const errors: string[] = []
  for (const task of mod.tasks) {
    for (const dep of task.depends_on) {
      if (!taskIds.has(dep)) {
        errors.push(`任务 "${task.id}" 依赖的任务 "${dep}" 不存在`)
      }
    }
  }
  return errors
}

export function detectCyclicDependencies(modules: ModulePlan[]): string[] | null {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const mod of modules) {
    inDegree.set(mod.slug, 0)
    adjacency.set(mod.slug, [])
  }

  const slugSet = new Set(modules.map(m => m.slug))
  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      if (slugSet.has(dep)) {
        adjacency.get(dep)!.push(mod.slug)
        inDegree.set(mod.slug, (inDegree.get(mod.slug) ?? 0) + 1)
      }
    }
  }

  let queue = modules.filter(m => inDegree.get(m.slug) === 0).map(m => m.slug)
  const sorted: string[] = []

  while (queue.length > 0) {
    sorted.push(...queue)
    const next: string[] = []
    for (const node of queue) {
      for (const neighbor of adjacency.get(node) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, deg)
        if (deg === 0) next.push(neighbor)
      }
    }
    queue = next
  }

  if (sorted.length === modules.length) return null
  const sortedSet = new Set(sorted)
  return modules.filter(m => !sortedSet.has(m.slug)).map(m => m.slug)
}
