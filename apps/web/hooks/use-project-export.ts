'use client'

import { useGuideStore } from '@/stores/guide-store'
import { exportMarkdownWithAnchors } from '@/lib/tmplan/data-access'
import { generateMarkdown, downloadMarkdown } from '@/lib/export-markdown'

interface UseProjectExportOptions {
  projectId: string
}

export function useProjectExport({ projectId }: UseProjectExportOptions) {
  const phaseResults = useGuideStore((s) => s.phaseResults)

  async function handleExport() {
    const concept = phaseResults.find((r) => r.phase === 'concept')
    const filename = concept?.project_name || '项目计划'

    try {
      const markdown = await exportMarkdownWithAnchors(projectId)
      downloadMarkdown(markdown, filename)
    } catch {
      const markdown = generateMarkdown(phaseResults)
      downloadMarkdown(markdown, filename)
    }
  }

  return {
    canExport: phaseResults.length > 0,
    handleExport,
  }
}
