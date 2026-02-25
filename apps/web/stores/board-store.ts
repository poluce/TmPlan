import { create } from 'zustand'
import type { ModulePlan, TaskStatus } from '@/types/tmplan'

interface BoardState {
  modules: ModulePlan[]
  selectedModule: string | null
  loading: boolean
  error: string | null
  activeLayer: 'feature' | 'implementation'
  projectName: string
  projectDescription: string

  fetchModules: (projectPath: string) => Promise<void>
  selectModule: (slug: string) => void
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

  fetchModules: async (projectPath: string) => {
    set({ loading: true, error: null })
    try {
      const { readAllModules } = await import('@/lib/tmplan/data-access')
      const modules = await readAllModules(projectPath)
      set({ modules, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      })
    }
  },

  selectModule: (slug: string) => {
    set({ selectedModule: slug })
  },

  updateTaskStatus: (moduleSlug: string, taskId: string, status: TaskStatus) => {
    const modules = get().modules.map((mod) => {
      if (mod.slug !== moduleSlug) return mod
      return {
        ...mod,
        tasks: mod.tasks.map((t) =>
          t.id === taskId ? { ...t, status } : t
        ),
      }
    })
    set({ modules })
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
