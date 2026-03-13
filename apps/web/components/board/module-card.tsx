'use client'

import { cn } from '@/lib/utils'

type Status = 'pending' | 'in_progress' | 'completed'

const statusConfig: Record<Status, { icon: string; label: string; color: string }> = {
  completed: { icon: '\u2705', label: '完成', color: 'border-green-500/50 bg-green-50 dark:bg-green-950/20' },
  in_progress: { icon: '\uD83D\uDD04', label: '进行中', color: 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20' },
  pending: { icon: '\u23F3', label: '待开始', color: 'border-muted bg-card' },
}

interface ModuleCardProps {
  name: string
  status: Status
  completedCount: number
  totalCount: number
  selected: boolean
  onClick: () => void
}

export function ModuleCard({
  name,
  status,
  completedCount,
  totalCount,
  selected,
  onClick,
}: ModuleCardProps) {
  const cfg = statusConfig[status]

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-w-[140px] flex-col rounded-lg border-2 p-3 text-left transition-all hover:shadow-md',
        cfg.color,
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <span className="text-sm font-medium">{name}</span>
      <span className="mt-1 text-xs text-muted-foreground">
        {cfg.icon} {cfg.label} {completedCount}/{totalCount} 项
      </span>
    </button>
  )
}
