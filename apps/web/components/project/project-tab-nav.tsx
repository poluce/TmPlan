'use client'

import { FileText, GitBranch, History, LayoutDashboard, Zap } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ProjectTabValue = 'docs' | 'board' | 'git' | 'progress' | 'events'

interface ProjectTabNavProps {
  activeTab: ProjectTabValue
  onTabChange: (value: ProjectTabValue) => void
}

function isProjectTabValue(value: string): value is ProjectTabValue {
  return value === 'docs' || value === 'board' || value === 'git' || value === 'progress' || value === 'events'
}

export function ProjectTabNav({ activeTab, onTabChange }: ProjectTabNavProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => {
      if (isProjectTabValue(value)) {
        onTabChange(value)
      }
    }}>
      <TabsList>
        <TabsTrigger value="docs" className="gap-1.5">
          <FileText className="size-3.5" />
          文档
        </TabsTrigger>
        <TabsTrigger value="board" className="gap-1.5">
          <LayoutDashboard className="size-3.5" />
          看板
        </TabsTrigger>
        <TabsTrigger value="events" className="gap-1.5">
          <History className="size-3.5" />
          事件日志
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
  )
}
