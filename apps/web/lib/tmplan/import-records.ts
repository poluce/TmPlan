import type { ProjectConfig } from '@/types/tmplan'
import type { FieldSourceRecord, ImportRecord, MergeAction, MergeSummary } from '@/types/tmplan-imports'

export interface AiGuidePlanSnapshot {
  projectName: string
  description: string
  techStack: string[]
  modules: Array<{
    module: string
    slug: string
    tasks: Array<{ id: string }>
  }>
  decisions: Array<{
    decision_id: number
    question: string
    chosen: string
  }>
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

export function summarizeMergeActions(actions: MergeAction[]): MergeSummary {
  const summary: MergeSummary = {
    filled: 0,
    replaced: 0,
    appended: 0,
    conflicts: 0,
    staged: 0,
  }

  for (const action of actions) {
    if (action === 'fill') summary.filled += 1
    else if (action === 'replace') summary.replaced += 1
    else if (action === 'append') summary.appended += 1
    else if (action === 'conflict') summary.conflicts += 1
    else summary.staged += 1
  }

  return summary
}

export function computeProjectDefinitionMergeAction(
  existingProject: ProjectConfig | null,
  projectName: string,
  projectDescription: string
): MergeAction {
  const existingName = existingProject?.name?.trim() || ''
  const existingDescription = existingProject?.description?.trim() || ''
  const incomingName = projectName.trim()
  const incomingDescription = projectDescription.trim()

  if (!existingName && !existingDescription) return 'fill'

  const sameName = !incomingName || normalizeText(existingName) === normalizeText(incomingName)
  const sameDescription = !incomingDescription || normalizeText(existingDescription) === normalizeText(incomingDescription)

  if (sameName && sameDescription) return 'append'
  return 'conflict'
}

export function computeModuleMergeAction(
  existingModules: Array<{ slug: string; module: string }>,
  importedModules: Array<{ slug: string; module: string }>
): MergeAction {
  if (importedModules.length === 0) return 'staged'
  if (existingModules.length === 0) return 'fill'

  const existingBySlug = new Map(existingModules.map((module) => [module.slug, module]))
  const hasConflict = importedModules.some((module) => {
    const existing = existingBySlug.get(module.slug)
    return existing ? normalizeText(existing.module) !== normalizeText(module.module) : false
  })

  return hasConflict ? 'conflict' : 'append'
}

export function computeDecisionMergeAction(
  existingDecisions: Array<{ decision_id: number; question: string; chosen: string }>,
  importedDecisions: Array<{ decision_id: number; question: string; chosen: string }>
): MergeAction {
  if (importedDecisions.length === 0) return 'staged'
  if (existingDecisions.length === 0) return 'fill'

  const existingById = new Map(existingDecisions.map((decision) => [decision.decision_id, decision]))
  const hasConflict = importedDecisions.some((decision) => {
    const existing = existingById.get(decision.decision_id)
    return existing
      ? normalizeText(existing.question) !== normalizeText(decision.question)
        || normalizeText(existing.chosen) !== normalizeText(decision.chosen)
      : false
  })

  return hasConflict ? 'conflict' : 'append'
}

export function computeTechStackMergeAction(existingTechStack: string[], importedTechStack: string[]): MergeAction {
  if (importedTechStack.length === 0) return 'staged'
  if (existingTechStack.length === 0) return 'fill'

  const left = [...new Set(existingTechStack.map(normalizeText))].sort().join('|')
  const right = [...new Set(importedTechStack.map(normalizeText))].sort().join('|')
  return left === right ? 'append' : 'conflict'
}

export function buildAiGuideImportMetadata(options: {
  importId: string
  recordedAt: string
  existingProject: ProjectConfig | null
  existingModules: Array<{ slug: string; module: string }>
  existingDecisions: Array<{ decision_id: number; question: string; chosen: string }>
  planResult: AiGuidePlanSnapshot
}): { importRecord: ImportRecord; fieldRecords: FieldSourceRecord[] } {
  const projectDefinitionAction = computeProjectDefinitionMergeAction(
    options.existingProject,
    options.planResult.projectName,
    options.planResult.description
  )
  const moduleAction = computeModuleMergeAction(options.existingModules, options.planResult.modules)
  const decisionAction = computeDecisionMergeAction(
    options.existingDecisions,
    options.planResult.decisions
  )
  const techStackAction = computeTechStackMergeAction(
    options.existingProject?.tech_stack ?? [],
    options.planResult.techStack
  )

  const fieldRecords: FieldSourceRecord[] = []

  if (options.planResult.projectName || options.planResult.description) {
    fieldRecords.push({
      field_key: 'project-definition',
      source_type: 'ai-guide',
      source_label: 'AI 引导保存',
      source_files: [],
      import_id: options.importId,
      recorded_at: options.recordedAt,
      merge_action: projectDefinitionAction,
      value_preview: [options.planResult.projectName, options.planResult.description].filter(Boolean).join(' · '),
    })
  }

  if (options.planResult.modules.length > 0) {
    fieldRecords.push({
      field_key: 'feature-scope',
      source_type: 'ai-guide',
      source_label: 'AI 引导保存',
      source_files: [],
      import_id: options.importId,
      recorded_at: options.recordedAt,
      merge_action: moduleAction,
      value_preview: `${options.planResult.modules.length} 个模块`,
    })
  }

  const taskCount = options.planResult.modules.reduce((sum, module) => sum + module.tasks.length, 0)
  if (taskCount > 0) {
    fieldRecords.push({
      field_key: 'execution-plan',
      source_type: 'ai-guide',
      source_label: 'AI 引导保存',
      source_files: [],
      import_id: options.importId,
      recorded_at: options.recordedAt,
      merge_action: moduleAction,
      value_preview: `${options.planResult.modules.length} 个模块 / ${taskCount} 个任务`,
    })
  }

  if (options.planResult.techStack.length > 0) {
    fieldRecords.push({
      field_key: 'tech-stack',
      source_type: 'ai-guide',
      source_label: 'AI 引导保存',
      source_files: [],
      import_id: options.importId,
      recorded_at: options.recordedAt,
      merge_action: techStackAction,
      value_preview: options.planResult.techStack.join(' / '),
    })
  }

  if (options.planResult.decisions.length > 0) {
    fieldRecords.push({
      field_key: 'decisions',
      source_type: 'ai-guide',
      source_label: 'AI 引导保存',
      source_files: [],
      import_id: options.importId,
      recorded_at: options.recordedAt,
      merge_action: decisionAction,
      value_preview: `${options.planResult.decisions.length} 条决策`,
    })
  }

  return {
    importRecord: {
      import_id: options.importId,
      imported_at: options.recordedAt,
      source_type: 'ai-guide',
      source_files: [],
      field_keys: [...new Set(fieldRecords.map((record) => record.field_key))],
      project_name: options.planResult.projectName,
      modules_imported: options.planResult.modules.map((module) => module.slug),
      decisions_imported: options.planResult.decisions.map((decision) => decision.decision_id),
      merge_summary: summarizeMergeActions(fieldRecords.map((record) => record.merge_action)),
    },
    fieldRecords,
  }
}
