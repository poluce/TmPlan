'use client'

import { useEffect } from 'react'
import { useBoardStore } from '@/stores/board-store'
import { getExecutionOrder, getTaskExecutionOrder } from '@/lib/tmplan/utils'
import type { ModulePlan } from '@/types/tmplan'
import { PipelineLayer } from './pipeline-layer'
import { ModuleCard } from './module-card'
import { TaskCard } from './task-card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PipelineBoardProps {
  projectPath?: string
  initialModules?: ModulePlan[]
  projectId?: string
}

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

  // Split modules by layer
  const featureModules = modules.filter((m) => m.layer === 'feature')
  const implModules = modules.filter((m) => (m.layer ?? 'implementation') === 'implementation')
  const hasFeatureLayer = featureModules.length > 0

  // Get modules for current layer
  const layerModules = activeLayer === 'feature' ? featureModules : implModules

  const moduleMap = new Map(layerModules.map((m) => [m.slug, m]))
  const moduleOrder = getExecutionOrder(layerModules)
  const selectedMod = selectedModule ? moduleMap.get(selectedModule) : null

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

      {/* Layer 1: Module Pipeline */}
      <div className="border-b p-4">
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

      <Separator />

      {/* Layer 2: Task Pipeline */}
      <div className="flex-1 overflow-auto p-4">
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
  )
}
