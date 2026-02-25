'use client'

import type { PhaseResult } from '@/stores/guide-store'
import { Button } from '@/components/ui/button'
import { Check, RotateCcw } from 'lucide-react'

interface PhaseResultPreviewProps {
  result: PhaseResult
  onConfirm: () => void
  onReguide: () => void
}

export function PhaseResultPreview({ result, onConfirm, onReguide }: PhaseResultPreviewProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">{result.message}</p>

      {result.phase === 'concept' && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">项目概念</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">名称：</span>{result.project_name}</p>
            <p><span className="text-muted-foreground">描述：</span>{result.description}</p>
            <p><span className="text-muted-foreground">目标用户：</span>{result.target_users}</p>
          </div>
        </div>
      )}

      {result.phase === 'features' && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">功能模块</h4>
          <div className="grid gap-2">
            {result.modules.map((m) => (
              <div key={m.slug} className="rounded-md border bg-background px-3 py-2">
                <p className="text-sm font-medium">{m.module}</p>
                <p className="text-xs text-muted-foreground">{m.overview}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.phase === 'ui-pages' && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">页面规划</h4>
          <div className="grid gap-2">
            {result.pages.map((p) => (
              <div key={p.slug} className="rounded-md border bg-background px-3 py-2">
                <p className="text-sm font-medium">{p.module}</p>
                <p className="text-xs text-muted-foreground">{p.overview}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.phase === 'tech-impl' && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">技术实现</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">技术栈：</span>{result.tech_stack.join(', ')}</p>
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
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onConfirm} className="gap-1.5">
          <Check className="size-3.5" />
          确认
        </Button>
        <Button size="sm" variant="outline" onClick={onReguide} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          重新引导
        </Button>
      </div>
    </div>
  )
}
