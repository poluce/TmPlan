'use client'

import { useGuideStore } from '@/stores/guide-store'
import type { PhaseResult } from '@/stores/guide-store'
import { exportMarkdownWithAnchors } from '@/lib/tmplan/data-access'
import { generateMarkdown, downloadMarkdown } from '@/lib/export-markdown'

interface UseProjectExportOptions {
  projectId: string
}

function getExportFilename(phaseResults: PhaseResult[]) {
  const concept = phaseResults.find((result) => result.phase === 'concept')
  return concept?.project_name || '项目计划'
}

export function useProjectExport({ projectId }: UseProjectExportOptions) {
  const phaseResults = useGuideStore((s) => s.phaseResults)

  async function handleExport() {
    const filename = getExportFilename(phaseResults)

    try {
      const markdown = await exportMarkdownWithAnchors(projectId)
      downloadMarkdown(markdown, filename)
    } catch {
      if (phaseResults.length === 0) {
        throw new Error('暂无可导出的规划数据')
      }
      const markdown = generateMarkdown(phaseResults)
      downloadMarkdown(markdown, filename)
    }
  }

  return {
    canExport: true,
    handleExport,
  }
}
