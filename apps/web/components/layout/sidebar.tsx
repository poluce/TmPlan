"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  FolderOpen,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useProjectStore } from "@/stores/project-store"
import { isTauri } from "@/lib/platform"

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [showProjects, setShowProjects] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const currentProjectId = pathname.match(/\/project\/([^/]+)/)?.[1]
  const rawProjects = useProjectStore((s) => s.projects)
  const projects = useMemo(
    () => [...rawProjects].sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()),
    [rawProjects]
  )
  const addProject = useProjectStore((s) => s.addProject)
  const removeProject = useProjectStore((s) => s.removeProject)

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed && (
          <Link href="/projects" className="text-lg font-bold tracking-tight">
            TmPlan
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      <Separator />

      {/* Project Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!collapsed && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setShowProjects(!showProjects)
                  router.push("/projects")
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    !showProjects && "-rotate-90"
                  )}
                />
                项目列表
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="新建项目"
                onClick={async () => {
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
                }}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            {showProjects && (
              <nav className="mt-1 space-y-0.5">
                {projects.map((project) => {
                  const isActive = currentProjectId && decodeURIComponent(currentProjectId) === project.path
                  return (
                    <div
                      key={project.path}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Link
                        href={`/project/${encodeURIComponent(project.path)}`}
                        className="flex flex-1 items-center gap-2 min-w-0"
                      >
                        <FolderOpen className="size-4 shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                      <button
                        className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        title="关闭项目"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeProject(project.path)
                          if (isActive) router.push('/projects')
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )
                })}
              </nav>
            )}
          </>
        )}

        {collapsed && (
          <nav className="space-y-1">
            {projects.map((project) => (
              <Link
                key={project.path}
                href={`/project/${encodeURIComponent(project.path)}`}
                title={project.name}
                className={cn(
                  "flex items-center justify-center rounded-md p-2 transition-colors",
                  currentProjectId && decodeURIComponent(currentProjectId) === project.path
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <FolderOpen className="size-4" />
              </Link>
            ))}
          </nav>
        )}
      </div>

      <Separator />

      {/* Settings */}
      <div className={cn("px-2 py-2", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("w-full", !collapsed && "justify-start")}
          asChild
        >
          <Link href="/settings">
            <Settings className="size-4" />
            {!collapsed && <span>设置</span>}
          </Link>
        </Button>
      </div>
    </aside>
  )
}
