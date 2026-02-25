"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronUp, ChevronDown } from "lucide-react"
import { AiGuidePanel } from "@/components/guide/ai-guide-panel"

export function AIPanel() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-t bg-background">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <span>AI 引导面板</span>
        {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {/* Expanded panel — full AiGuidePanel */}
      {expanded && (
        <div className="h-[420px] overflow-hidden">
          <AiGuidePanel projectPath={pathname} />
        </div>
      )}
    </div>
  )
}
