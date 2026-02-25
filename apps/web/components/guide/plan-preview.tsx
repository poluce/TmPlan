'use client'

import { Package, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PlanResult } from '@/stores/guide-store'

interface PlanPreviewProps {
  plan: PlanResult
  onSave: () => void
  onReset: () => void
  saving?: boolean
}

export function PlanPreview({ plan, onSave, onReset, saving = false }: PlanPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{plan.projectName}</h3>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>

      {/* Tech stack */}
      <div className="flex flex-wrap gap-1.5">
        {plan.techStack.map((tech) => (
          <span
            key={tech}
            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
          >
            {tech}
          </span>
        ))}
      </div>

      <Separator />

      {/* Modules */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          模块计划（{plan.modules.length} 个模块）
        </p>
        <div className="grid gap-2">
          {plan.modules.map((mod, i) => (
            <Card key={i} className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{mod.module}</span>
                      <span className="text-xs text-muted-foreground">
                        {mod.tasks.length} 个任务
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mod.overview}</p>
                    {mod.tasks.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {mod.tasks.map((t) => (
                          <li key={t.id} className="text-xs text-muted-foreground pl-2">
                            • {t.title}
                          </li>
                        ))}
                      </ul>
                    )}
                    {mod.depends_on.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="size-3" />
                        依赖：{mod.depends_on.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} className="flex-1">
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {saving ? '保存中...' : '确认并保存'}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={saving}>
          重新引导
        </Button>
      </div>
    </div>
  )
}
