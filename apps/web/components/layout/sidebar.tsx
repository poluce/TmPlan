"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Zap,
  MessageSquare,
  Settings,
  FolderOpen,
  ChevronDown,
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
  const projects = useProjectStore((s) => s.listProjects())
  const addProject = useProjectStore((s) => s.addProject)

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
                {projects.map((project) => (
                  <Link
                    key={project.path}
                    href={`/project/${encodeURIComponent(project.path)}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      currentProjectId && decodeURIComponent(currentProjectId) === project.path
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <FolderOpen className="size-4 shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
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

      {/* Quick Actions */}
      <div className={cn("space-y-1 px-2 py-2", collapsed && "flex flex-col items-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("w-full", !collapsed && "justify-start")}
          title="新增模块"
          onClick={() => toast.info("新增模块功能开发中")}
        >
          <Plus className="size-4" />
          {!collapsed && <span>新增模块</span>}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("w-full", !collapsed && "justify-start")}
          title="手动检查"
          onClick={() => toast.info("手动检查功能开发中")}
        >
          <Zap className="size-4" />
          {!collapsed && <span>手动检查</span>}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          className={cn("w-full", !collapsed && "justify-start")}
          title="AI对话"
          onClick={() => toast.info("AI对话功能开发中")}
        >
          <MessageSquare className="size-4" />
          {!collapsed && <span>AI对话</span>}
        </Button>
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
