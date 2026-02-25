'use client'

import { useState, useRef } from 'react'
import { useGuideStore, GUIDE_PHASES } from '@/stores/guide-store'
import type { PhaseResult } from '@/stores/guide-store'
import { useBoardStore } from '@/stores/board-store'
import { useActiveProfile } from '@/stores/settings-store'
import { ChevronDown, ChevronRight, Lock, CheckCircle2, Download, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateMarkdown, downloadMarkdown } from '@/lib/export-markdown'
import { toast } from 'sonner'

function PhaseContent({ result }: { result: PhaseResult }) {
  if (result.phase === 'concept') {
    return (
      <div className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">名称：</span>{result.project_name}</p>
        <p><span className="text-muted-foreground">描述：</span>{result.description}</p>
        <p><span className="text-muted-foreground">目标用户：</span>{result.target_users}</p>
      </div>
    )
  }

  if (result.phase === 'features') {
    return (
      <div className="grid gap-2">
        {result.modules.map((m) => (
          <div key={m.slug} className="rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium">{m.module}</p>
            <p className="text-xs text-muted-foreground">{m.overview}</p>
          </div>
        ))}
      </div>
    )
  }

  if (result.phase === 'ui-pages') {
    return (
      <div className="grid gap-2">
        {result.pages.map((p) => (
          <div key={p.slug} className="rounded-md border bg-background px-3 py-2">
            <p className="text-sm font-medium">{p.module}</p>
            <p className="text-xs text-muted-foreground">{p.overview}</p>
          </div>
        ))}
      </div>
    )
  }

  if (result.phase === 'tech-impl') {
    return (
      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">技术栈：</span>{result.tech_stack.join(', ')}
        </div>
        <div className="grid gap-2">
          {result.modules.map((m) => (
            <div key={m.slug} className="rounded-md border bg-background px-3 py-2">
              <p className="text-sm font-medium">{m.module}</p>
              <p className="text-xs text-muted-foreground">{m.overview}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.tasks.length} 个任务</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

const PHASE_LABELS: Record<string, string> = {
  concept: '概念确认',
  features: '功能梳理',
  'ui-pages': '页面规划',
  'tech-impl': '技术实现',
}

export function PhaseDocsPanel() {
  const phaseResults = useGuideStore((s) => s.phaseResults)
  const importPhaseResults = useGuideStore((s) => s.importPhaseResults)
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeProfile = useActiveProfile()
  const { updateProjectMeta, addFeatureModules, addImplModules } = useBoardStore()

  const completedSlugs = new Set(phaseResults.map((r) => r.phase))
  const resultMap = new Map(phaseResults.map((r) => [r.phase, r]))

  function handleExport() {
    const md = generateMarkdown(phaseResults)
    const concept = phaseResults.find((r) => r.phase === 'concept')
    const filename = concept?.project_name || '项目计划'
    downloadMarkdown(md, filename)
  }

  async function handleImport(file: File) {
    if (!activeProfile?.apiKey) {
      toast.error('请先在设置中配置 API Key')
      return
    }

    if (file.size > 200 * 1024) {
      toast.error('文件过大，请上传 200KB 以内的文件')
      return
    }

    setImporting(true)
    try {
      const markdown = await file.text()

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

      // Import to guide store
      importPhaseResults(phases)

      // Sync to board store (same logic as ai-guide-panel.tsx handleConfirmPhase)
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
    if (file) handleImport(file)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b bg-background px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {importing ? '解析中...' : '导入'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={phaseResults.length === 0}
        >
          <Download className="size-3.5" />
          导出
        </Button>
      </div>

      {/* Content */}
      {phaseResults.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-foreground text-center">
            请通过左侧 AI 引导完成各阶段规划，或导入已有的 Markdown 计划文档
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {GUIDE_PHASES.map(({ slug }) => {
            const completed = completedSlugs.has(slug)
            const expanded = expandedPhase === slug
            const result = resultMap.get(slug)

            if (!completed) {
              return (
                <div
                  key={slug}
                  className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-muted-foreground/50"
                >
                  <Lock className="size-4" />
                  <span className="text-sm">{PHASE_LABELS[slug]}</span>
                </div>
              )
            }

            return (
              <div key={slug} className="rounded-lg border bg-muted/30">
                <button
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                  onClick={() => setExpandedPhase(expanded ? null : slug)}
                >
                  {expanded ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" />
                  )}
                  <span className="text-sm font-medium flex-1">{PHASE_LABELS[slug]}</span>
                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                </button>
                {expanded && result && (
                  <div className="px-4 pb-4">
                    <PhaseContent result={result} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
