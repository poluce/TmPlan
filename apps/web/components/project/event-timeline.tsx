'use client'

import { useState, useEffect, useCallback } from 'react'
import { queryEvents } from '@/lib/tmplan/data-access'
import type { PPFEvent } from '@/types/event-sourcing'
import { ChevronDown, ChevronRight, Clock, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ---- 操作类型中文映射 ----
const ACTION_TYPE_LABELS: Record<string, string> = {
  'task.create': '创建任务',
  'task.update': '更新任务',
  'task.delete': '删除任务',
  'task.move': '移动任务',
  'module.create': '创建模块',
  'module.update': '更新模块',
  'module.delete': '删除模块',
  'decision.create': '创建决策',
  'decision.update': '更新决策',
  'phase.create': '创建阶段',
  'phase.update': '更新阶段',
  'project.update': '更新项目',
  'status.sync': '状态同步',
}

const SOURCE_LABELS: Record<string, string> = {
  ui: '界面操作',
  nlp: 'AI 解析',
  markdown: 'Markdown 同步',
  webhook: 'Webhook',
  extension: '扩展',
}

// ---- 按日期分组 ----
function groupByDate(events: PPFEvent[]): Map<string, PPFEvent[]> {
  const groups = new Map<string, PPFEvent[]>()
  for (const event of events) {
    const date = event.timestamp.slice(0, 10)
    const existing = groups.get(date) ?? []
    groups.set(date, [...existing, event])
  }
  return groups
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

// ---- 单条事件 ----
function EventItem({ event }: { readonly event: PPFEvent }) {
  const [expanded, setExpanded] = useState(false)
  const label = ACTION_TYPE_LABELS[event.type] ?? event.type
  const sourceLabel = SOURCE_LABELS[event.source] ?? event.source

  return (
    <div className="group relative pl-6 pb-4">
      {/* 时间线竖线 */}
      <div className="absolute left-[9px] top-3 bottom-0 w-px bg-border group-last:hidden" />
      {/* 时间线圆点 */}
      <div className="absolute left-[5px] top-[7px] size-[9px] rounded-full border-2 border-primary bg-background" />

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground truncate">
              {event.target_id}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{formatTime(event.timestamp)}</span>
            <span>·</span>
            <span>{sourceLabel}</span>
            {event.actor && (
              <>
                <span>·</span>
                <span>{event.actor}</span>
              </>
            )}
          </div>
        </div>

        {event.patches.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* 展开的 JSON Patch 详情 */}
      {expanded && event.patches.length > 0 && (
        <div className="mt-2 rounded-md border bg-muted/50 p-2 text-xs font-mono overflow-x-auto">
          {event.patches.map((patch, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span
                className={
                  patch.op === 'add'
                    ? 'text-green-600'
                    : patch.op === 'remove'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                }
              >
                {patch.op}
              </span>
              <span className="text-muted-foreground">{patch.path}</span>
              {patch.value !== undefined && (
                <span className="truncate">
                  → {JSON.stringify(patch.value)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- 类型过滤器选项 ----
const TYPE_FILTER_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'task.update', label: '更新任务' },
  { value: 'task.create', label: '创建任务' },
  { value: 'module.create', label: '创建模块' },
  { value: 'module.update', label: '更新模块' },
  { value: 'project.update', label: '更新项目' },
]

// ---- 主组件 ----
export function EventTimeline({ projectPath }: { readonly projectPath: string }) {
  const [events, setEvents] = useState<PPFEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await queryEvents(projectPath, {
        type: typeFilter || undefined,
        limit: 100,
      } as Record<string, unknown>)
      setEvents(result)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [projectPath, typeFilter])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const grouped = groupByDate(events)
  // 按日期倒序
  const sortedDates = [...grouped.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="h-full flex flex-col">
      {/* 过滤器 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Filter className="size-3.5 text-muted-foreground" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={loadEvents} className="ml-auto text-xs">
          刷新
        </Button>
      </div>

      {/* 事件列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
            <Clock className="size-8 mb-2 opacity-50" />
            <p>暂无事件记录</p>
            <p className="text-xs mt-1">操作任务状态后，事件将显示在这里</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="mb-4">
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-1 mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {formatDate(date)} · {date}
                </span>
              </div>
              {(grouped.get(date) ?? [])
                .slice()
                .reverse()
                .map((event) => (
                  <EventItem key={event.event_id} event={event} />
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
