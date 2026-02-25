"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, Zap, Settings, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useProjectStore } from "@/stores/project-store"
import { isTauri } from "@/lib/platform"
import { cn } from "@/lib/utils"

export function Topbar() {
  const pathname = usePathname()
  const currentProjectId = pathname.match(/\/project\/([^/]+)/)?.[1]
  const projects = useProjectStore((s) => s.listProjects())
  const currentProject = currentProjectId
    ? projects.find((p) => p.path === decodeURIComponent(currentProjectId))
    : undefined

  const [aiStatus, setAiStatus] = useState<string>('stopped')

  useEffect(() => {
    if (!isTauri()) return
    import('@/lib/tmplan/tauri-bridge').then(({ getAiEngineStatus }) => {
      getAiEngineStatus().then(setAiStatus).catch(() => setAiStatus('stopped'))
    })
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left: Project name with dropdown */}
      <div className="flex items-center gap-2">
        {currentProject ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 text-base font-semibold">
                {currentProject.name}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {projects.map((project) => (
                <DropdownMenuItem key={project.path} asChild>
                  <Link href={`/project/${encodeURIComponent(project.path)}`}>{project.name}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-base font-semibold">TmPlan</span>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => toast.info("手动检查功能开发中")}>
          <Zap className="size-4" />
          手动检查
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info("新增模块功能开发中")}>
          <Plus className="size-4" />
          新增模块
        </Button>
        <span
          className={cn(
            "size-2 rounded-full",
            aiStatus === 'running' ? 'bg-green-500' : aiStatus === 'starting' ? 'bg-yellow-500' : 'bg-red-400'
          )}
          title={`AI Engine: ${aiStatus}`}
        />
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/settings" aria-label="设置">
            <Settings className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
