"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FolderOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useProjectStore } from "@/stores/project-store"
import { isTauri } from "@/lib/platform"

export default function ProjectsPage() {
  const router = useRouter()
  const projects = useProjectStore((s) => s.listProjects())
  const addProject = useProjectStore((s) => s.addProject)

  const handleNewProject = async () => {
    let selectedPath: string | null = null
    if (isTauri()) {
      const { pickDirectory } = await import('@/lib/tmplan/tauri-bridge')
      selectedPath = await pickDirectory()
    } else {
      selectedPath = window.prompt("请输入项目文件夹的完整路径：", "")
    }
    if (selectedPath && selectedPath.trim()) {
      const path = selectedPath.trim()
      addProject({
        path,
        name: path.split(/[/\\]/).pop() || path,
        description: '',
        modulesCount: 0,
        completedModules: 0,
        lastOpenedAt: new Date().toISOString(),
      })
      router.push(`/project/${encodeURIComponent(path)}?new=1`)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">项目列表</h1>
        <Button onClick={handleNewProject}>
          <Plus className="size-4" />
          新建项目
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <FolderOpen className="size-12 mb-4" />
          <p className="text-lg">还没有项目，点击「新建项目」开始</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.path} href={`/project/${encodeURIComponent(project.path)}`}>
              <Card className="p-4 transition-shadow hover:shadow-md cursor-pointer">
                <div className="mb-2 flex items-center gap-2">
                  <FolderOpen className="size-5 text-muted-foreground" />
                  <h2 className="font-semibold">{project.name}</h2>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {project.description || '暂无描述'}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    模块进度: {project.completedModules}/{project.modulesCount}
                  </span>
                  <span>上次打开: {project.lastOpenedAt ? new Date(project.lastOpenedAt).toLocaleString() : '-'}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${project.modulesCount > 0 ? (project.completedModules / project.modulesCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
