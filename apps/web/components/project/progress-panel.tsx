'use client'

import { useState, useCallback } from 'react'
import { isTauri } from '@/lib/platform'
import { useBoardStore } from '@/stores/board-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import type { ProjectProgress, ModuleProgress } from '@/lib/tmplan/tauri-bridge'

interface ProgressPanelProps {
  projectPath: string
}

export function ProgressPanel({ projectPath }: ProgressPanelProps) {
  const modules = useBoardStore((s) => s.modules)
  const [progress, setProgress] = useState<ProjectProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkProgress = useCallback(async () => {
    if (!isTauri()) {
      setError('进度检查仅在桌面应用中可用')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { checkProjectProgress } = await import('@/lib/tmplan/tauri-bridge')
      const result = await checkProjectProgress(projectPath, modules)
      setProgress(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '检查进度失败')
    } finally {
      setLoading(false)
    }
  }, [projectPath, modules])

  if (!isTauri()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        进度检查仅在桌面应用中可用
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">进度检查</h2>
        <Button variant="outline" size="sm" onClick={checkProgress} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          检查
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {progress && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">总体进度</span>
              <span className="text-sm text-muted-foreground">
                {progress.existing_files} / {progress.total_files} 文件
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${progress.total_files > 0 ? (progress.existing_files / progress.total_files) * 100 : 0}%`,
                }}
              />
            </div>
          </Card>

          <div className="space-y-3">
            {progress.modules.map((mod: ModuleProgress) => (
              <Card key={mod.slug} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{mod.slug}</span>
                  <span className="text-xs text-muted-foreground">
                    {mod.existing_files} / {mod.total_files}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted mb-3">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${mod.total_files > 0 ? (mod.existing_files / mod.total_files) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="space-y-1">
                  {mod.files.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 text-xs">
                      {f.exists ? (
                        <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-red-400 shrink-0" />
                      )}
                      <code className="truncate font-mono">{f.path}</code>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {!progress && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="size-8 mb-2" />
          <p className="text-sm">点击「检查」按钮开始进度检查</p>
        </div>
      )}
    </div>
  )
}
