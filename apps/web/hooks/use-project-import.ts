'use client'

import { useRef, useState } from 'react'
import { useBoardStore } from '@/stores/board-store'
import { useGuideStore } from '@/stores/guide-store'
import type { PhaseResult } from '@/stores/guide-store'
import { useActiveProfile } from '@/stores/settings-store'
import { importMarkdownAST } from '@/lib/tmplan/data-access'
import { toast } from 'sonner'

interface UseProjectImportOptions {
  projectId: string
}

type ModuleStatus = 'pending' | 'in_progress' | 'completed'
type ModulePriority = 'low' | 'medium' | 'high' | 'critical'

function toModuleStatus(value: string | null | undefined): ModuleStatus {
  if (value === 'pending' || value === 'in_progress' || value === 'completed') {
    return value
  }
  return 'pending'
}

function toModulePriority(value: string | null | undefined): ModulePriority {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value
  }
  return 'medium'
}

export function useProjectImport({ projectId }: UseProjectImportOptions) {
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeProfile = useActiveProfile()
  const importPhaseResults = useGuideStore((s) => s.importPhaseResults)
  const updateProjectMeta = useBoardStore((s) => s.updateProjectMeta)
  const addFeatureModules = useBoardStore((s) => s.addFeatureModules)
  const addImplModules = useBoardStore((s) => s.addImplModules)

  async function handleImport(file: File) {
    if (file.size > 200 * 1024) {
      toast.error('文件过大，请上传 200KB 以内的文件')
      return
    }

    setImporting(true)
    try {
      const markdown = await file.text()

      try {
        const astResult = await importMarkdownAST(projectId, markdown)
        if (astResult.anchorsFound > 0 || astResult.modules.length > 0) {
          const now = new Date().toISOString()
          const importedModules = astResult.modules.map((mod) => ({
            module: mod.module,
            slug: mod.slug,
            layer: 'implementation' as const,
            status: toModuleStatus(mod.status),
            depends_on: [...mod.depends_on],
            decision_refs: [],
            overview: mod.overview,
            priority: toModulePriority(mod.priority),
            estimated_hours: null,
            created_at: now,
            updated_at: now,
            tasks: mod.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status === 'completed' ? 'completed' as const : 'pending' as const,
              depends_on: [],
              detail: '',
              files_to_create: [],
              files_to_modify: [],
              acceptance_criteria: [],
            })),
          }))

          addImplModules(importedModules)

          const projectName = typeof astResult.project.name === 'string' ? astResult.project.name : ''
          const projectDescription = typeof astResult.project.description === 'string' ? astResult.project.description : ''
          if (projectName) {
            updateProjectMeta(projectName, projectDescription)
          }

          const importedPhases: PhaseResult[] = [
            {
              phase: 'concept',
              project_name: projectName || '项目计划',
              description: projectDescription,
              target_users: '',
              message: '通过 Markdown AST 导入项目概念。',
            },
            {
              phase: 'tech-impl',
              tech_stack: [],
              modules: importedModules.map((module) => ({
                module: module.module,
                slug: module.slug,
                overview: module.overview,
                priority: module.priority,
                depends_on: [...module.depends_on],
                tasks: module.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  detail: task.detail,
                  depends_on: [...task.depends_on],
                  files_to_create: [...task.files_to_create],
                  files_to_modify: [...task.files_to_modify],
                  acceptance_criteria: [...task.acceptance_criteria],
                })),
              })),
              decisions: [],
              message: '通过 Markdown AST 导入技术实现模块。',
            },
          ]

          importPhaseResults(importedPhases)
          toast.success(`AST 解析成功：${astResult.modules.length} 个模块，${astResult.anchorsFound} 个锚点匹配`)
          return
        }
      } catch {
        // AST 解析失败，回退到 AI 解析
      }

      if (!activeProfile?.apiKey) {
        toast.error('请先在设置中配置 API Key')
        return
      }

      const res = await fetch('/api/ai/parse-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown,
          apiKey: activeProfile.apiKey,
          baseUrl: activeProfile.baseUrl,
          modelName: activeProfile.modelName,
          modelType: activeProfile.modelType,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '解析失败' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const { phases } = await res.json() as { phases: PhaseResult[] }

      if (!phases || phases.length === 0) {
        toast.error('未能从文档中解析出有效的计划数据')
        return
      }

      importPhaseResults(phases)

      for (const r of phases) {
        if (r.phase === 'concept') {
          updateProjectMeta(r.project_name, r.description)
        } else if (r.phase === 'features') {
          addFeatureModules(r.modules)
        } else if (r.phase === 'ui-pages') {
          addFeatureModules(r.pages)
        } else if (r.phase === 'tech-impl') {
          const now = new Date().toISOString()
          addImplModules(
            r.modules.map((m) => ({
              module: m.module,
              slug: m.slug,
              layer: 'implementation' as const,
              status: 'pending' as const,
              depends_on: m.depends_on || [],
              decision_refs: [],
              overview: m.overview,
              priority: toModulePriority(m.priority),
              estimated_hours: null,
              created_at: now,
              updated_at: now,
              tasks: (m.tasks || []).map((t) => ({
                id: t.id,
                title: t.title,
                status: 'pending' as const,
                depends_on: t.depends_on || [],
                detail: t.detail,
                files_to_create: t.files_to_create || [],
                files_to_modify: t.files_to_modify || [],
                acceptance_criteria: t.acceptance_criteria || [],
              })),
            }))
          )
        }
      }

      toast.success(`成功导入 ${phases.length} 个阶段的数据`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleImport(file)
  }

  return {
    fileInputRef,
    importing,
    handleFileChange,
  }
}
