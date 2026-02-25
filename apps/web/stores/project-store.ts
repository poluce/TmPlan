import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProjectEntry {
  path: string
  name: string
  description: string
  modulesCount: number
  completedModules: number
  lastOpenedAt: string
}

interface ProjectStoreState {
  projects: ProjectEntry[]
  addProject: (project: ProjectEntry) => void
  removeProject: (path: string) => void
  updateProject: (path: string, patch: Partial<Omit<ProjectEntry, 'path'>>) => void
  touchProject: (path: string) => void
  listProjects: () => ProjectEntry[]
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: [],

      addProject: (project) => {
        const existing = get().projects
        // Don't add duplicates
        if (existing.some((p) => p.path === project.path)) {
          // Update instead
          set({
            projects: existing.map((p) =>
              p.path === project.path ? { ...p, ...project, lastOpenedAt: new Date().toISOString() } : p
            ),
          })
          return
        }
        set({ projects: [...existing, { ...project, lastOpenedAt: new Date().toISOString() }] })
      },

      removeProject: (path) => {
        set({ projects: get().projects.filter((p) => p.path !== path) })
      },

      updateProject: (path, patch) => {
        set({
          projects: get().projects.map((p) =>
            p.path === path ? { ...p, ...patch } : p
          ),
        })
      },

      touchProject: (path) => {
        set({
          projects: get().projects.map((p) =>
            p.path === path ? { ...p, lastOpenedAt: new Date().toISOString() } : p
          ),
        })
      },

      listProjects: () => {
        return [...get().projects].sort(
          (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
        )
      },
    }),
    {
      name: 'tmplan-projects',
      version: 1,
    }
  )
)
