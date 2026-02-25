'use client'

import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types/tmplan'

const statusConfig: Record<TaskStatus, { icon: string; label: string; color: string }> = {
  completed: { icon: '\u2705', label: '完成', color: 'border-green-500/50 bg-green-50 dark:bg-green-950/20' },
  in_progress: { icon: '\uD83D\uDD04', label: '进行中', color: 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20' },
  pending: { icon: '\u23F3', label: '待开始', color: 'border-muted bg-card' },
  blocked: { icon: '\uD83D\uDEAB', label: '阻塞', color: 'border-red-500/50 bg-red-50 dark:bg-red-950/20' },
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
  blocked: 'pending',
}

interface TaskCardProps {
  title: string
  status: TaskStatus
  detail: string
  onStatusChange: (newStatus: TaskStatus) => void
}

export function TaskCard({ title, status, detail, onStatusChange }: TaskCardProps) {
  const cfg = statusConfig[status]
  const truncatedDetail = detail.length > 50 ? detail.slice(0, 50) + '...' : detail

  return (
    <div
      className={cn(
        'flex min-w-[160px] flex-col rounded-lg border-2 p-3',
        cfg.color
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <button
        onClick={() => onStatusChange(NEXT_STATUS[status])}
        className="mt-1 w-fit text-xs text-muted-foreground hover:underline"
      >
        {cfg.icon} {cfg.label}
      </button>
      <span className="mt-2 text-xs text-muted-foreground">{truncatedDetail}</span>
    </div>
  )
}
