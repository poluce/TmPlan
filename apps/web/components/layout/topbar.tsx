"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProjectStore } from "@/stores/project-store"
import { isTauri } from "@/lib/platform"
import { cn } from "@/lib/utils"

export function Topbar() {
  const pathname = usePathname()
  const currentProjectId = pathname.match(/\/project\/([^/]+)/)?.[1]
  const rawProjects = useProjectStore((s) => s.projects)
  const projects = useMemo(
    () => [...rawProjects].sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()),
    [rawProjects]
  )
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

  if (pathname.startsWith('/settings')) return null

  return (
    <div className="border-b bg-background">
      <header className="flex h-14 items-center justify-between px-4">
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
            <div />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              aiStatus === 'running' ? 'bg-green-500' : aiStatus === 'starting' ? 'bg-yellow-500' : 'bg-red-400'
            )}
            title={`AI Engine: ${aiStatus}`}
          />
        </div>
      </header>
      {currentProject && (
        <div className="px-4 pb-2 text-xs text-muted-foreground truncate">
          {currentProject.path}
        </div>
      )}
    </div>
  )
}
