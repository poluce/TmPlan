'use client'

import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [isOpen, setIsOpen] = useState(false)
  const cfg = statusConfig[status]
  const nextStatus = NEXT_STATUS[status]
  const nextStatusLabel = statusConfig[nextStatus].label
  const detailText = detail.trim() || '暂无详细说明'
  const truncatedDetail = detail.length > 50 ? detail.slice(0, 50) + '...' : detail

  const openDetail = () => setIsOpen(true)

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  const handleStatusClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onStatusChange(nextStatus)
  }

  const handleStatusKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div
        role="button"
        tabIndex={0}
        onClick={openDetail}
        onKeyDown={handleCardKeyDown}
        className={cn(
          'flex min-w-[160px] cursor-pointer flex-col rounded-lg border-2 p-3 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          cfg.color
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium">{title}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">查看详情</span>
        </div>
        <button
          type="button"
          onClick={handleStatusClick}
          onKeyDown={handleStatusKeyDown}
          className="mt-1 w-fit text-xs text-muted-foreground hover:underline"
        >
          {cfg.icon} {cfg.label}
        </button>
        <span className="mt-2 text-xs text-muted-foreground">{truncatedDetail}</span>
      </div>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            当前状态：{cfg.icon} {cfg.label}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="text-xs font-medium tracking-wide text-muted-foreground">
            任务详情
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {detailText}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onStatusChange(nextStatus)}>
            标记为{nextStatusLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
