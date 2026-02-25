import type { ModulePlan, ModuleTask, DependencyGraph } from '@/types/tmplan'

/**
 * 计算所有模块的总进度百分比 (0-100)
 */
export function calculateProgress(modules: ModulePlan[]): number {
  if (modules.length === 0) return 0

  let totalTasks = 0
  let completedTasks = 0

  for (const mod of modules) {
    for (const task of mod.tasks) {
      totalTasks++
      if (task.status === 'completed') completedTasks++
    }
  }

  if (totalTasks === 0) return 0
  return Math.round((completedTasks / totalTasks) * 100)
}

/**
 * 构建模块间的依赖图（使用 slug 做标识）
 */
export function buildDependencyGraph(modules: ModulePlan[]): DependencyGraph {
  const nodes = modules.map((m) => m.slug)
  const edges: Array<{ from: string; to: string }> = []

  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      edges.push({ from: dep, to: mod.slug })
    }
  }

  return { nodes, edges }
}

/**
 * 返回模块执行顺序（考虑并行），每个内层数组中的模块可以并行执行
 * 使用拓扑排序（Kahn算法），使用 slug 做标识
 */
export function getExecutionOrder(modules: ModulePlan[]): string[][] {
  const moduleMap = new Map(modules.map((m) => [m.slug, m]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const mod of modules) {
    inDegree.set(mod.slug, 0)
    adjacency.set(mod.slug, [])
  }

  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      if (moduleMap.has(dep)) {
        adjacency.get(dep)!.push(mod.slug)
        inDegree.set(mod.slug, (inDegree.get(mod.slug) ?? 0) + 1)
      }
    }
  }

  const result: string[][] = []
  let queue = modules
    .filter((m) => inDegree.get(m.slug) === 0)
    .map((m) => m.slug)

  while (queue.length > 0) {
    result.push([...queue])
    const nextQueue: string[] = []

    for (const node of queue) {
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          nextQueue.push(neighbor)
        }
      }
    }

    queue = nextQueue
  }

  const sortedCount = result.reduce((sum, layer) => sum + layer.length, 0)
  if (sortedCount < modules.length) {
    throw new Error('模块间存在循环依赖，无法确定执行顺序')
  }

  return result
}

/**
 * 返回任务执行顺序（考虑并行），每个内层数组中的任务可以并行执行
 */
export function getTaskExecutionOrder(tasks: ModuleTask[]): string[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const t of tasks) {
    inDegree.set(t.id, 0)
    adjacency.set(t.id, [])
  }

  for (const t of tasks) {
    for (const dep of t.depends_on) {
      if (taskMap.has(dep)) {
        adjacency.get(dep)!.push(t.id)
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1)
      }
    }
  }

  const result: string[][] = []
  let queue = tasks
    .filter((t) => inDegree.get(t.id) === 0)
    .map((t) => t.id)

  while (queue.length > 0) {
    result.push([...queue])
    const nextQueue: string[] = []
    for (const node of queue) {
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) nextQueue.push(neighbor)
      }
    }
    queue = nextQueue
  }

  return result
}
