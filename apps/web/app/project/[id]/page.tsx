'use client'

import { use, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PipelineBoard } from '@/components/board/pipeline-board'
import { AiGuidePanel } from '@/components/guide/ai-guide-panel'
import { useBoardStore } from '@/stores/board-store'
import { useGuideStore } from '@/stores/guide-store'
import { useProjectStore } from '@/stores/project-store'
import { readProject, readAllModules } from '@/lib/tmplan/data-access'
import { Button } from '@/components/ui/button'
import { Bot, PanelLeftClose, PanelLeft, FileText, LayoutDashboard, GitBranch, Zap } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PhaseDocsPanel } from '@/components/docs/phase-docs-panel'
import { GitInfoPanel } from '@/components/project/git-info-panel'
import { ProgressPanel } from '@/components/project/progress-panel'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === '1'
  const projectId = decodeURIComponent(id)

  const { projectName, projectDescription } = useBoardStore()
  const guideReset = useGuideStore((s) => s.reset)
  const touchProject = useProjectStore((s) => s.touchProject)
  const updateProject = useProjectStore((s) => s.updateProject)

  const [showGuide, setShowGuide] = useState(isNew)
  const [activeTab, setActiveTab] = useState<'docs' | 'board' | 'git' | 'progress'>('docs')
  const [projectDesc, setProjectDesc] = useState('')

  // Reset guide store when opening a new project for planning
  useEffect(() => {
    if (isNew) {
      guideReset()
      setShowGuide(true)
    }
  }, [projectId, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load project data on mount
  useEffect(() => {
    touchProject(projectId)
    readProject(projectId)
      .then((config) => {
        setProjectDesc(config.description)
        useBoardStore.getState().updateProjectMeta(config.name, config.description)
        updateProject(projectId, { name: config.name, description: config.description })
      })
      .catch(() => {})
    readAllModules(projectId)
      .then((modules) => {
        useBoardStore.getState().setModules(modules)
        const completed = modules.filter((m) => m.status === 'completed').length
        updateProject(projectId, { modulesCount: modules.length, completedModules: completed })
      })
      .catch(() => {})
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayDesc = projectName ? projectDescription : projectDesc || projectId

  return (
    <div className="flex h-full">
      {/* Left: Guide Panel */}
      {showGuide && (
        <div className="w-[380px] shrink-0 border-r flex flex-col">
          <AiGuidePanel projectPath={projectId} />
        </div>
      )}

      {/* Right: Board */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setShowGuide(!showGuide)}
              title={showGuide ? '隐藏引导面板' : '显示引导面板'}
            >
              {showGuide ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </Button>
            <p className="text-sm text-muted-foreground">{displayDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            {!showGuide && (
              <Button variant="outline" size="sm" onClick={() => setShowGuide(true)} className="gap-1.5">
                <Bot className="size-3.5" />
                AI 引导
              </Button>
            )}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'docs' | 'board' | 'git' | 'progress')}>
              <TabsList>
                <TabsTrigger value="docs" className="gap-1.5">
                  <FileText className="size-3.5" />
                  文档
                </TabsTrigger>
                <TabsTrigger value="board" className="gap-1.5">
                  <LayoutDashboard className="size-3.5" />
                  看板
                </TabsTrigger>
                <TabsTrigger value="git" className="gap-1.5">
                  <GitBranch className="size-3.5" />
                  Git
                </TabsTrigger>
                <TabsTrigger value="progress" className="gap-1.5">
                  <Zap className="size-3.5" />
                  进度
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeTab === 'docs' ? (
            <PhaseDocsPanel />
          ) : activeTab === 'git' ? (
            <GitInfoPanel projectPath={projectId} />
          ) : activeTab === 'progress' ? (
            <ProgressPanel projectPath={projectId} />
          ) : (
            <PipelineBoard projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  )
}
