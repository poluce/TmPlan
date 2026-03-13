'use client'

import { useState } from 'react'
import { useGuideStore, GUIDE_PHASES } from '@/stores/guide-store'
import type { PhaseResult } from '@/stores/guide-store'
import type { DocFile } from '@/lib/tmplan/data-access'
import { ChevronDown, ChevronRight, Lock, CheckCircle2, FileText, Loader2, Circle } from 'lucide-react'
import type { ConvertProgress } from '@/lib/tmplan/data-access'

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

export function PhaseDocsPanel({ projectDocs = [], convertProgress }: { projectDocs?: DocFile[]; convertProgress?: ConvertProgress | null }) {
  const phaseResults = useGuideStore((s) => s.phaseResults)
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null)
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

  const completedSlugs = new Set(phaseResults.map((r) => r.phase))
  const resultMap = new Map(phaseResults.map((r) => [r.phase, r]))

  const hasContent = phaseResults.length > 0 || projectDocs.length > 0

  return (
    <div className="flex h-full flex-col">
      {!hasContent ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-foreground text-center">
            请通过左侧 AI 引导完成各阶段规划，或导入已有的 Markdown 计划文档
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Project docs from /docs directory */}
          {projectDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">项目文档</p>
              {projectDocs.map((doc) => {
                const expanded = expandedDoc === doc.path
                return (
                  <div key={doc.path} className="rounded-lg border bg-muted/30">
                    <button
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                      onClick={() => setExpandedDoc(expanded ? null : doc.path)}
                    >
                      {expanded ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium flex-1 truncate">{doc.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{doc.path}</span>
                      {convertProgress && (() => {
                        const status = convertProgress.docStatus[doc.path]
                        if (status === 'reading') return <Loader2 className="size-4 animate-spin text-blue-500 shrink-0" />
                        if (status === 'done') return <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        if (status === 'pending') return <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                        return null
                      })()}
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4">
                        <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-background rounded-md p-3 border max-h-96 overflow-y-auto">
                          {doc.content}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
              {convertProgress && convertProgress.overall !== 'idle' && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  {convertProgress.overall === 'done' ? (
                    <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                  ) : convertProgress.overall === 'error' ? (
                    <Circle className="size-3.5 text-red-500 shrink-0" />
                  ) : (
                    <Loader2 className="size-3.5 animate-spin text-blue-500 shrink-0" />
                  )}
                  <span className={convertProgress.overall === 'error' ? 'text-red-500' : 'text-muted-foreground'}>
                    {convertProgress.message}
                  </span>
                </div>
              )}
            </div>
          )}
          {phaseResults.length > 0 && (
            <div className="space-y-2">
              {projectDocs.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground px-1">规划阶段</p>
              )}
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
      )}
    </div>
  )
}
