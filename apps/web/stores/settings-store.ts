import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModelType = 'openai' | 'claude' | 'custom'

export interface ModelProfile {
  id: string
  label: string
  modelType: ModelType
  apiKey: string
  baseUrl: string
  modelName: string
}

export interface DocPath {
  path: string
  enabled: boolean
}

interface SettingsState {
  profiles: ModelProfile[]
  activeProfileId: string | null
  docPaths: DocPath[]

  addProfile: (profile: Omit<ModelProfile, 'id'>) => string
  updateProfile: (id: string, patch: Partial<Omit<ModelProfile, 'id'>>) => void
  deleteProfile: (id: string) => void
  setActiveProfileId: (id: string | null) => void
  getActiveProfile: () => ModelProfile | null
  addDocPath: (path: string) => void
  removeDocPath: (path: string) => void
  toggleDocPath: (path: string) => void
}

const DEFAULT_BASE_URLS: Record<ModelType, string> = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com',
  custom: '',
}

const DEFAULT_MODELS: Record<ModelType, string> = {
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4',
  custom: '',
}

export { DEFAULT_BASE_URLS, DEFAULT_MODELS }

function generateId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Old v1 shape for migration
interface V1State {
  modelType: ModelType
  apiKey: string
  baseUrl: string
  modelName: string
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      docPaths: [{ path: 'docs', enabled: true }],

      addProfile: (profile) => {
        const id = generateId()
        const newProfile: ModelProfile = { id, ...profile }
        set((s) => {
          const profiles = [...s.profiles, newProfile]
          return {
            profiles,
            activeProfileId: s.activeProfileId ?? id,
          }
        })
        return id
      },

      updateProfile: (id, patch) => {
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        }))
      },

      deleteProfile: (id) => {
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id)
          const activeProfileId =
            s.activeProfileId === id
              ? (profiles[0]?.id ?? null)
              : s.activeProfileId
          return { profiles, activeProfileId }
        })
      },

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get()
        return profiles.find((p) => p.id === activeProfileId) ?? null
      },

      addDocPath: (path) => {
        set((s) => {
          if (s.docPaths.some((d) => d.path === path)) return s
          return { docPaths: [...s.docPaths, { path, enabled: true }] }
        })
      },

      removeDocPath: (path) => {
        set((s) => ({
          docPaths: s.docPaths.filter((d) => d.path !== path),
        }))
      },

      toggleDocPath: (path) => {
        set((s) => ({
          docPaths: s.docPaths.map((d) =>
            d.path === path ? { ...d, enabled: !d.enabled } : d
          ),
        }))
      },
    }),
    {
      name: 'tmplan-settings',
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version === 0 || version === 1) {
          // Migrate from v1 single-config format
          const old = state as Partial<V1State> & Record<string, unknown>
          if (old.apiKey || old.baseUrl || old.modelType) {
            const id = generateId()
            const modelType = old.modelType || 'openai'
            const profile: ModelProfile = {
              id,
              label: modelType === 'claude' ? 'Claude' : modelType === 'openai' ? 'OpenAI' : '自定义',
              modelType,
              apiKey: old.apiKey || '',
              baseUrl: old.baseUrl || DEFAULT_BASE_URLS[modelType],
              modelName: old.modelName || DEFAULT_MODELS[modelType],
            }
            return {
              profiles: [profile],
              activeProfileId: id,
              docPaths: [{ path: 'docs', enabled: true }],
            }
          }
          return { profiles: [], activeProfileId: null, docPaths: [{ path: 'docs', enabled: true }] }
        }
        if (version === 2) {
          // v2 -> v3: add docPaths
          return { ...state, docPaths: [{ path: 'docs', enabled: true }] }
        }
        return persisted as SettingsState
      },
    }
  )
)

/** Convenience selector for the active profile */
export function useActiveProfile(): ModelProfile | null {
  return useSettingsStore((s) => {
    return s.profiles.find((p) => p.id === s.activeProfileId) ?? null
  })
}
