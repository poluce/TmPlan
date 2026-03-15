'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from '@/stores/board-store'
import { getExecutionOrder, getTaskExecutionOrder } from '@/lib/tmplan/utils'
import type { ModulePlan } from '@/types/tmplan'
import { PipelineLayer } from './pipeline-layer'
import { ModuleCard } from './module-card'
import { TaskCard } from './task-card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface PipelineBoardProps {
  projectPath?: string
  initialModules?: ModulePlan[]
  projectId?: string
}

const RESIZER_HEIGHT = 14
const MIN_OVERVIEW_HEIGHT = 160
const MIN_TASK_HEIGHT = 220

export function PipelineBoard({ projectPath, initialModules, projectId }: PipelineBoardProps) {
  const {
    modules,
    selectedModule,
    loading,
    error,
    activeLayer,
    fetchModules,
    selectModule,
    updateTaskStatus,
    setModules,
    setActiveLayer,
  } = useBoardStore()
  const splitPaneRef = useRef<HTMLDivElement | null>(null)
  const [overviewHeight, setOverviewHeight] = useState(280)
  const [isResizing, setIsResizing] = useState(false)

  const clampOverviewHeight = useCallback((nextHeight: number) => {
    const container = splitPaneRef.current
    if (!container) return Math.max(nextHeight, MIN_OVERVIEW_HEIGHT)

    const maxHeight = Math.max(
      MIN_OVERVIEW_HEIGHT,
      container.clientHeight - MIN_TASK_HEIGHT - RESIZER_HEIGHT
    )

    return Math.min(Math.max(nextHeight, MIN_OVERVIEW_HEIGHT), maxHeight)
  }, [])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const container = splitPaneRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const nextHeight = event.clientY - rect.top
    setOverviewHeight(clampOverviewHeight(nextHeight))
  }, [clampOverviewHeight])

  useEffect(() => {
    console.info('[PipelineBoard] init', {
      projectPath,
      projectId,
      initialModulesCount: initialModules?.length ?? 0,
    })

    if (initialModules) {
      console.info('[PipelineBoard] using initial modules', {
        projectPath,
        projectId,
        modulesCount: initialModules.length,
      })
      setModules(initialModules)
      const inProgress = initialModules.find((m) => m.status === 'in_progress')
      const nextSelectedModule = inProgress?.slug ?? initialModules[0]?.slug ?? null
      console.info('[PipelineBoard] selecting initial module', {
        projectPath,
        projectId,
        selectedModule: nextSelectedModule,
      })
      selectModule(nextSelectedModule)
    } else if (projectPath) {
      console.info('[PipelineBoard] fetching modules from projectPath', {
        projectPath,
        projectId,
      })
      void fetchModules(projectPath)
    } else {
      console.warn('[PipelineBoard] missing projectPath and initialModules; board may be empty', {
        projectPath,
        projectId,
      })
    }
  }, [projectPath, initialModules, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const syncHeight = () => {
      setOverviewHeight((prev) => clampOverviewHeight(prev))
    }

    syncHeight()
    window.addEventListener('resize', syncHeight)
    return () => window.removeEventListener('resize', syncHeight)
  }, [clampOverviewHeight])

  useEffect(() => {
    if (!isResizing) return

    const handlePointerUp = () => setIsResizing(false)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, isResizing])

  // Split modules by layer
  const featureModules = modules.filter((m) => m.layer === 'feature')
  const implModules = modules.filter((m) => (m.layer ?? 'implementation') === 'implementation')
  const hasFeatureLayer = featureModules.length > 0

  // Get modules for current layer
  const layerModules = activeLayer === 'feature' ? featureModules : implModules

  const moduleMap = new Map(layerModules.map((m) => [m.slug, m]))
  const moduleOrder = getExecutionOrder(layerModules)
  const selectedMod = selectedModule ? moduleMap.get(selectedModule) : null

  useEffect(() => {
    if (layerModules.length === 0) {
      if (selectedModule !== null) {
        selectModule(null)
      }
      return
    }

    if (!selectedModule || !layerModules.some((module) => module.slug === selectedModule)) {
      selectModule(layerModules[0]?.slug ?? null)
    }
  }, [layerModules, selectModule, selectedModule])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    )
  }

  // Build module layer columns
  const moduleColumns = moduleOrder.map((colSlugs) =>
    colSlugs.map((slug) => {
      const mod = moduleMap.get(slug)!
      const completed = mod.tasks.filter((t) => t.status === 'completed').length
      return (
        <ModuleCard
          key={slug}
          name={mod.module}
          status={mod.status}
          completedCount={completed}
          totalCount={mod.tasks.length}
          selected={selectedModule === slug}
          onClick={() => selectModule(slug)}
        />
      )
    })
  )

  // Build task layer columns
  let taskColumns: React.ReactNode[][] = []
  if (selectedMod) {
    const taskMap = new Map(selectedMod.tasks.map((t) => [t.id, t]))
    const taskOrder = getTaskExecutionOrder(selectedMod.tasks)
    taskColumns = taskOrder.map((colIds) =>
      colIds.map((id) => {
        const task = taskMap.get(id)!
        return (
          <TaskCard
            key={id}
            title={task.title}
            status={task.status}
            detail={task.detail}
            onStatusChange={(newStatus) =>
              updateTaskStatus(selectedMod.slug, id, newStatus)
            }
          />
        )
      })
    )
  }

  // No modules at all
  if (modules.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        暂无模块数据，请通过左侧 AI 引导生成项目计划
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher — only show when feature layer has modules */}
      {hasFeatureLayer && (
        <div className="border-b px-4 pt-2">
          <Tabs value={activeLayer} onValueChange={(v) => {
            console.info('[PipelineBoard] switching layer', {
              projectPath,
              projectId,
              from: activeLayer,
              to: v,
            })
            setActiveLayer(v as 'feature' | 'implementation')
          }}>
            <TabsList>
              <TabsTrigger value="feature">功能规划</TabsTrigger>
              <TabsTrigger value="implementation">实现规划</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <div ref={splitPaneRef} className="flex min-h-0 flex-1 flex-col">
        {/* Layer 1: Module Pipeline */}
        <div
          className="min-h-0 overflow-auto border-b p-4"
          style={{ height: `${overviewHeight}px` }}
        >
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {activeLayer === 'feature' ? '功能模块总览' : '项目步骤总览'}
          </h2>
          {layerModules.length > 0 ? (
            <PipelineLayer columns={moduleColumns} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {activeLayer === 'feature' ? '暂无功能模块' : '暂无实现模块，请完成技术阶段引导'}
            </p>
          )}
        </div>

        <div
          role="separator"
          aria-label="调整步骤总览与子任务区域高度"
          aria-orientation="horizontal"
          tabIndex={0}
          className={cn(
            'group flex h-[14px] shrink-0 cursor-row-resize items-center justify-center border-y bg-background transition-colors',
            isResizing && 'bg-accent/60'
          )}
          onPointerDown={(event) => {
            event.preventDefault()
            setIsResizing(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setOverviewHeight((prev) => clampOverviewHeight(prev - 24))
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOverviewHeight((prev) => clampOverviewHeight(prev + 24))
            }
          }}
        >
          <div className="h-1 w-14 rounded-full bg-border transition-colors group-hover:bg-foreground/25" />
        </div>

        {/* Layer 2: Task Pipeline */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {selectedMod ? (
            <>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {selectedMod.module} — 子任务
              </h2>
              {selectedMod.tasks.length > 0 ? (
                <PipelineLayer columns={taskColumns} />
              ) : (
                <p className="text-sm text-muted-foreground">该模块暂无子任务</p>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              点击上方模块查看子任务
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
