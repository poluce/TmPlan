'use client'

import { useState, useEffect, useCallback } from 'react'
import { isTauri } from '@/lib/platform'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefreshCw, GitBranch, GitCommit, FileText } from 'lucide-react'

interface GitInfoPanelProps {
  projectPath: string
}

export function GitInfoPanel({ projectPath }: GitInfoPanelProps) {
  const [branch, setBranch] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [log, setLog] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setError('Git 信息仅在桌面应用中可用')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { runGitCommand } = await import('@/lib/tmplan/tauri-bridge')
      const [branchResult, statusResult, logResult] = await Promise.all([
        runGitCommand(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
        runGitCommand(projectPath, ['status', '--short']),
        runGitCommand(projectPath, ['log', '--oneline', '-20']),
      ])
      setBranch(branchResult.trim())
      setStatus(statusResult)
      setLog(logResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取 Git 信息失败')
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!isTauri()) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Git 信息仅在桌面应用中可用
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Git 信息</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {branch && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">当前分支</span>
          </div>
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{branch}</code>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">文件状态</span>
        </div>
        <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto whitespace-pre max-h-48 overflow-y-auto">
          {status || '工作区干净'}
        </pre>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <GitCommit className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">最近提交</span>
        </div>
        <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto whitespace-pre max-h-64 overflow-y-auto">
          {log || '暂无提交记录'}
        </pre>
      </Card>
    </div>
  )
}
