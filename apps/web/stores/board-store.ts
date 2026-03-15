import { create } from 'zustand'
import { dispatchProjectUpdated } from '@/lib/tmplan/client-events'
import type { ModulePlan, TaskStatus } from '@/types/tmplan'

interface BoardState {
  modules: ModulePlan[]
  selectedModule: string | null
  loading: boolean
  error: string | null
  activeLayer: 'feature' | 'implementation'
  projectName: string
  projectDescription: string
  projectPath: string | null

  fetchModules: (projectPath: string) => Promise<void>
  selectModule: (slug: string | null) => void
  updateTaskStatus: (moduleSlug: string, taskId: string, status: TaskStatus) => void
  setModules: (modules: ModulePlan[]) => void
  setActiveLayer: (layer: 'feature' | 'implementation') => void
  addFeatureModules: (modules: Array<{ module: string; slug: string; overview: string }>) => void
  addImplModules: (modules: ModulePlan[]) => void
  updateProjectMeta: (name: string, description: string) => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  modules: [],
  selectedModule: null,
  loading: false,
  error: null,
  activeLayer: 'implementation',
  projectName: '',
  projectDescription: '',
  projectPath: null,

  fetchModules: async (projectPath: string) => {
    console.info('[board-store] fetchModules:start', { projectPath })
    set({ loading: true, error: null, projectPath })
    try {
      const { readAllModules } = await import('@/lib/tmplan/data-access')
      const modules = await readAllModules(projectPath)
      console.info('[board-store] fetchModules:success', {
        projectPath,
        modulesCount: modules.length,
        featureModulesCount: modules.filter((module) => module.layer === 'feature').length,
        implementationModulesCount: modules.filter((module) => (module.layer ?? 'implementation') === 'implementation').length,
      })
      set({ modules, loading: false })
    } catch (err) {
      console.error('[board-store] fetchModules:error', {
        projectPath,
        error: err instanceof Error ? err.message : err,
      })
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      })
    }
  },

  selectModule: (slug: string | null) => {
    set({ selectedModule: slug })
  },

  updateTaskStatus: (moduleSlug: string, taskId: string, status: TaskStatus) => {
    const prevModules = get().modules
    // 乐观更新 UI
    const modules = prevModules.map((mod) => {
      if (mod.slug !== moduleSlug) return mod
      return {
        ...mod,
        tasks: mod.tasks.map((t) =>
          t.id === taskId ? { ...t, status } : t
        ),
      }
    })
    set({ modules })

    // 异步持久化到文件系统
    const projectPath = get().projectPath
    if (projectPath) {
      import('@/lib/tmplan/data-access').then(({ persistTaskStatus }) => {
        persistTaskStatus(projectPath, moduleSlug, taskId, status)
          .then(() => {
            dispatchProjectUpdated(projectPath)
          })
          .catch(() => {
            // 持久化失败，回滚
            set({ modules: prevModules })
          })
      })
    }
  },

  setModules: (modules: ModulePlan[]) => {
    set({ modules })
  },

  setActiveLayer: (layer: 'feature' | 'implementation') => {
    set({ activeLayer: layer, selectedModule: null })
  },

  addFeatureModules: (featureModules) => {
    const now = new Date().toISOString()
    const newModules: ModulePlan[] = featureModules.map((m) => ({
      module: m.module,
      slug: m.slug,
      layer: 'feature' as const,
      status: 'pending' as const,
      depends_on: [],
      decision_refs: [],
      overview: m.overview,
      priority: 'medium' as const,
      estimated_hours: null,
      created_at: now,
      updated_at: now,
      tasks: [],
    }))

    const existing = get().modules
    // Replace existing feature modules, keep implementation modules
    const implModules = existing.filter((m) => (m.layer ?? 'implementation') !== 'feature')
    set({ modules: [...implModules, ...newModules] })
  },

  addImplModules: (implModules) => {
    const existing = get().modules
    // Replace existing implementation modules, keep feature modules
    const featureModules = existing.filter((m) => m.layer === 'feature')
    set({ modules: [...featureModules, ...implModules] })
  },

  updateProjectMeta: (name: string, description: string) => {
    set({ projectName: name, projectDescription: description })
  },
}))
