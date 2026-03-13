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

export function useProjectImport({ projectId }: UseProjectImportOptions) {
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeProfile = useActiveProfile()
  const importPhaseResults = useGuideStore((s) => s.importPhaseResults)
  const { updateProjectMeta, addFeatureModules, addImplModules } = useBoardStore()

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
          for (const mod of astResult.modules) {
            addImplModules([{
              module: mod.module,
              slug: mod.slug,
              layer: 'implementation' as const,
              status: (mod.status as 'pending' | 'in_progress' | 'completed') || 'pending',
              depends_on: [...mod.depends_on],
              decision_refs: [],
              overview: mod.overview,
              priority: (mod.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
              estimated_hours: null,
              created_at: now,
              updated_at: now,
              tasks: mod.tasks.map((t) => ({
                id: t.id,
                title: t.title,
                status: (t.status as 'pending' | 'completed') || 'pending',
                depends_on: [],
                detail: '',
                files_to_create: [],
                files_to_modify: [],
                acceptance_criteria: [],
              })),
            }])
          }
          if (astResult.project.name) {
            updateProjectMeta(astResult.project.name as string, (astResult.project.description as string) ?? '')
          }
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
              priority: (m.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
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
