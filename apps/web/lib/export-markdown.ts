import type { PhaseResult } from '@/stores/guide-store'

export function generateMarkdown(phaseResults: PhaseResult[]): string {
  const lines: string[] = []

  const concept = phaseResults.find((r) => r.phase === 'concept')
  const features = phaseResults.find((r) => r.phase === 'features')
  const uiPages = phaseResults.find((r) => r.phase === 'ui-pages')
  const techImpl = phaseResults.find((r) => r.phase === 'tech-impl')

  // Title
  const projectName = concept?.project_name || '项目计划'
  lines.push(`# ${projectName}`)
  lines.push('')

  // Concept
  if (concept) {
    lines.push('## 项目概述')
    lines.push('')
    lines.push(`- **项目名称**：${concept.project_name}`)
    lines.push(`- **项目描述**：${concept.description}`)
    lines.push(`- **目标用户**：${concept.target_users}`)
    lines.push('')
  }

  // Features
  if (features) {
    lines.push('## 功能模块')
    lines.push('')
    for (const m of features.modules) {
      lines.push(`### ${m.module}`)
      lines.push('')
      lines.push(m.overview)
      lines.push('')
    }
  }

  // UI Pages
  if (uiPages) {
    lines.push('## 页面规划')
    lines.push('')
    for (const p of uiPages.pages) {
      lines.push(`### ${p.module}`)
      lines.push('')
      lines.push(p.overview)
      lines.push('')
    }
  }

  // Tech Implementation
  if (techImpl) {
    lines.push('## 技术实现')
    lines.push('')

    if (techImpl.tech_stack.length > 0) {
      lines.push('### 技术栈')
      lines.push('')
      for (const t of techImpl.tech_stack) {
        lines.push(`- ${t}`)
      }
      lines.push('')
    }

    for (const m of techImpl.modules) {
      lines.push(`### ${m.module}`)
      lines.push('')
      lines.push(m.overview)
      lines.push('')
      if (m.tasks.length > 0) {
        for (const t of m.tasks) {
          lines.push(`- [ ] **${t.title}**：${t.detail}`)
        }
        lines.push('')
      }
    }

    if (techImpl.decisions.length > 0) {
      lines.push('## 决策记录')
      lines.push('')
      for (const d of techImpl.decisions) {
        lines.push(`### 决策 ${d.decision_id}：${d.question}`)
        lines.push('')
        lines.push(`- **选择**：${d.chosen}`)
        lines.push(`- **原因**：${d.reason}`)
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
