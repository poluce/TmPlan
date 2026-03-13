'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PipelineBoard } from '@/components/board/pipeline-board'
import { AiGuidePanel } from '@/components/guide/ai-guide-panel'
import { PhaseDocsPanel } from '@/components/docs/phase-docs-panel'
import { GitInfoPanel } from '@/components/project/git-info-panel'
import { ProgressPanel } from '@/components/project/progress-panel'
import { EventTimeline } from '@/components/project/event-timeline'
import { ProjectToolbar } from '@/components/project/project-toolbar'
import { ProjectTabNav, type ProjectTabValue } from '@/components/project/project-tab-nav'
import { useGuideStore } from '@/stores/guide-store'
import { useProjectStore } from '@/stores/project-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useBoardStore } from '@/stores/board-store'
import { readAllModules, readDocs, readProject } from '@/lib/tmplan/data-access'
import type { DocFile } from '@/lib/tmplan/data-access'
import { useProjectImport } from '@/hooks/use-project-import'
import { useProjectExport } from '@/hooks/use-project-export'
import { useDocumentConverter } from '@/hooks/use-document-converter'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const projectId = decodeURIComponent(id)
  const isNew = searchParams.get('new') === '1'

  const guideReset = useGuideStore((s) => s.reset)
  const touchProject = useProjectStore((s) => s.touchProject)
  const updateProject = useProjectStore((s) => s.updateProject)

  const [showGuide, setShowGuide] = useState(isNew)
  const [activeTab, setActiveTab] = useState<ProjectTabValue>('docs')
  const [projectDocs, setProjectDocs] = useState<DocFile[]>([])

  const { fileInputRef, importing, handleFileChange } = useProjectImport({ projectId })
  const { canExport, handleExport } = useProjectExport({ projectId })
  const { convertProgress, isConverting, handleConvert } = useDocumentConverter({ projectId, projectDocs })

  useEffect(() => {
    if (isNew) {
      guideReset()
      setShowGuide(true)
    }
  }, [guideReset, isNew, projectId])

  useEffect(() => {
    touchProject(projectId)

    readProject(projectId)
      .then((config) => {
        useBoardStore.getState().updateProjectMeta(config.name, config.description)
        updateProject(projectId, { name: config.name, description: config.description })
      })
      .catch(() => {})

    readAllModules(projectId)
      .then((modules) => {
        useBoardStore.getState().setModules(modules)
        useBoardStore.setState({ projectPath: projectId })
        const completedModules = modules.filter((module) => module.status === 'completed').length
        updateProject(projectId, {
          modulesCount: modules.length,
          completedModules,
        })
      })
      .catch(() => {})
  }, [projectId, touchProject, updateProject])

  useEffect(() => {
    const enabledPaths = useSettingsStore.getState().docPaths
      .filter((docPath) => docPath.enabled)
      .map((docPath) => docPath.path)

    if (enabledPaths.length === 0) {
      setProjectDocs([])
      return
    }

    readDocs(projectId, enabledPaths)
      .then(setProjectDocs)
      .catch(() => {})
  }, [projectId])

  return (
    <div className="flex h-full">
      {showGuide && (
        <div className="w-[380px] shrink-0 border-r flex flex-col">
          <AiGuidePanel projectPath={projectId} />
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <ProjectTabNav activeTab={activeTab} onTabChange={setActiveTab} />
          <ProjectToolbar
            showGuide={showGuide}
            onToggleGuide={() => setShowGuide((prev) => !prev)}
            onConvert={handleConvert}
            onManualCheck={() => toast.info('手动检查功能开发中')}
            onAddModule={() => toast.info('新增模块功能开发中')}
            onImport={() => fileInputRef.current?.click()}
            onExport={handleExport}
            importing={importing}
            isConverting={isConverting}
            canExport={canExport}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'docs' ? (
            <PhaseDocsPanel projectDocs={projectDocs} convertProgress={convertProgress} />
          ) : activeTab === 'events' ? (
            <EventTimeline projectPath={projectId} />
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
