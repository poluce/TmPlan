'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, FolderKanban, Layers3, Rocket, ShieldCheck, Users } from 'lucide-react'
import { useBoardStore } from '@/stores/board-store'
import {
  useGuideStore,
  type ConceptPhaseResult,
  type FeaturesPhaseResult,
  type PhaseResult,
  type TechImplPhaseResult,
  type UiPagesPhaseResult,
} from '@/stores/guide-store'
import { readAllDecisions, readImportMetadata, readProject, readStatus } from '@/lib/tmplan/data-access'
import { subscribeProjectUpdated } from '@/lib/tmplan/client-events'
import type { DocFile } from '@/lib/tmplan/data-access'
import type { Decision, ProjectConfig, ProjectStatus } from '@/types/tmplan'
import type { FieldSourceRegistry, ImportManifest, MergeAction } from '@/types/tmplan-imports'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ProjectOverviewProps {
  projectPath: string
  projectDocs: DocFile[]
}

type SlotStatus = 'confirmed' | 'partial' | 'missing' | 'conflict'

interface StandardDocDefinition {
  id: string
  title: string
  stage: string
  required: boolean
  aliases: string[]
}

interface OverviewField {
  key: string
  label: string
  status: SlotStatus
  value: string
  detail: string
  sources: string[]
  gap?: string
}

interface OverviewSection {
  key: string
  title: string
  description: string
  fields: OverviewField[]
}

const STANDARD_DOCS: StandardDocDefinition[] = [
  { id: 'project-charter', title: '项目章程', stage: '立项', required: true, aliases: ['01-project-charter', 'project-charter', '项目章程'] },
  { id: 'product-requirements', title: '产品需求文档', stage: '需求', required: true, aliases: ['02-product-requirements', 'product-requirements', 'prd', '产品需求'] },
  { id: 'ux-spec', title: 'UX / IA 规范', stage: '设计', required: true, aliases: ['03-ux-spec', 'ux-spec', 'ia-spec', 'ux'] },
  { id: 'system-design', title: '系统设计', stage: '技术', required: true, aliases: ['04-system-design', 'system-design', 'architecture', '系统设计'] },
  { id: 'adr-log', title: 'ADR 决策记录', stage: '技术', required: false, aliases: ['05-adr-log', 'adr-log', 'adr'] },
  { id: 'execution-plan', title: '执行计划', stage: '执行', required: true, aliases: ['06-execution-plan', 'execution-plan', 'delivery-plan', '执行计划'] },
  { id: 'qa-acceptance', title: '质量与验收计划', stage: '质量', required: true, aliases: ['07-qa-acceptance', 'qa-acceptance', 'acceptance', 'qa'] },
  { id: 'release-operations', title: '发布与运维计划', stage: '发布', required: false, aliases: ['08-release-operations', 'release-operations', 'ops', 'runbook'] },
  { id: 'retrospective', title: '项目复盘与收尾', stage: '收尾', required: false, aliases: ['09-retrospective', 'retrospective', 'postmortem', '复盘'] },
]

const STATUS_META: Record<SlotStatus, { label: string; className: string }> = {
  confirmed: {
    label: '已确认',
    className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  },
  partial: {
    label: '部分覆盖',
    className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  },
  missing: {
    label: '待补充',
    className: 'bg-muted text-muted-foreground',
  },
  conflict: {
    label: '有冲突',
    className: 'bg-red-500/12 text-red-700 dark:text-red-300',
  },
}

const MERGE_ACTION_LABEL: Record<MergeAction, string> = {
  fill: '填空',
  replace: '替换',
  append: '补充',
  conflict: '冲突',
  staged: '待合并',
}

const EMPTY_PHASE_RESULTS: PhaseResult[] = []

function normalizeDocPath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function getDocStem(path: string): string {
  const normalizedPath = normalizeDocPath(path)
  const fileName = normalizedPath.split('/').pop() || normalizedPath
  return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function uniqueNonEmpty(values: Array<string | null | undefined | false>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    )
  )
}

function hasConflictingText(values: string[]): boolean {
  return new Set(values.map(normalizeText).filter(Boolean)).size > 1
}

function haveSetConflict(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false

  const normalizeSet = (values: string[]) => uniqueNonEmpty(values).map(normalizeText).sort().join('|')
  return normalizeSet(left) !== normalizeSet(right)
}

function truncateText(value: string, maxLength = 64): string {
  const normalized = value.trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`
}

function formatDocSource(label: string, docs: DocFile[]): string | null {
  return docs.length > 0 ? `文档/${label} x${docs.length}` : null
}

function getMatchedDocs(projectDocs: DocFile[]) {
  return STANDARD_DOCS.map((definition) => {
    const docs = projectDocs.filter((doc) => {
      const docStem = getDocStem(doc.path)
      return definition.aliases.some((alias) => docStem === normalizeText(alias))
    })

    return { definition, docs }
  })
}

function getDocCoverageStatus(matches: DocFile[]): SlotStatus {
  return matches.length > 0 ? 'confirmed' : 'missing'
}

function formatImportSourceLabel(label: string, action: MergeAction): string {
  return `${label} · ${MERGE_ACTION_LABEL[action]}`
}

function formatImportTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProjectOverview({ projectPath, projectDocs }: ProjectOverviewProps) {
  const projectName = useBoardStore((s) => s.projectName)
  const projectDescription = useBoardStore((s) => s.projectDescription)
  const modules = useBoardStore((s) => s.modules)
  const guideProjectPath = useGuideStore((s) => s.projectPath)
  const storedPhaseResults = useGuideStore((s) => s.phaseResults)
  const phaseResults = guideProjectPath === projectPath ? storedPhaseResults : EMPTY_PHASE_RESULTS

  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [importManifest, setImportManifest] = useState<ImportManifest>({ imports: [] })
  const [fieldSourceRegistry, setFieldSourceRegistry] = useState<FieldSourceRegistry>({ fields: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOverviewData = useCallback(async (cancelledRef?: { current: boolean }) => {
    setLoading(true)
    setError(null)

    try {
      const [nextProject, nextDecisions, nextStatus, importMetadata] = await Promise.all([
        readProject(projectPath).catch(() => null),
        readAllDecisions(projectPath).catch(() => []),
        readStatus(projectPath).catch(() => null),
        readImportMetadata(projectPath).catch(() => ({
          manifest: { imports: [] },
          fieldSources: { fields: {} },
        })),
      ])

      if (cancelledRef?.current) return

      setProjectConfig(nextProject)
      setDecisions(nextDecisions)
      setStatus(nextStatus)
      setImportManifest(importMetadata.manifest)
      setFieldSourceRegistry(importMetadata.fieldSources)
    } catch (nextError) {
      if (cancelledRef?.current) return
      setError(nextError instanceof Error ? nextError.message : '读取总览数据失败')
    } finally {
      if (!cancelledRef?.current) setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    const cancelledRef = { current: false }

    void loadOverviewData(cancelledRef)

    const unsubscribe = subscribeProjectUpdated((updatedProjectPath) => {
      if (updatedProjectPath === projectPath) {
        void loadOverviewData()
      }
    })

    return () => {
      cancelledRef.current = true
      unsubscribe()
    }
  }, [loadOverviewData, projectPath])

  const conceptPhase = useMemo(
    () => phaseResults.find((result): result is ConceptPhaseResult => result.phase === 'concept'),
    [phaseResults]
  )
  const featuresPhase = useMemo(
    () => phaseResults.find((result): result is FeaturesPhaseResult => result.phase === 'features'),
    [phaseResults]
  )
  const uiPagesPhase = useMemo(
    () => phaseResults.find((result): result is UiPagesPhaseResult => result.phase === 'ui-pages'),
    [phaseResults]
  )
  const techImplPhase = useMemo(
    () => phaseResults.find((result): result is TechImplPhaseResult => result.phase === 'tech-impl'),
    [phaseResults]
  )

  const matchedDocs = useMemo(() => getMatchedDocs(projectDocs), [projectDocs])
  const featureModules = modules.filter((module) => module.layer === 'feature')
  const implementationModules = modules.filter((module) => (module.layer ?? 'implementation') === 'implementation')
  const taskCount = implementationModules.reduce((total, module) => total + module.tasks.length, 0)
  const acceptanceCriteriaCount = implementationModules.reduce(
    (total, module) =>
      total + module.tasks.reduce((taskTotal, task) => taskTotal + task.acceptance_criteria.length, 0),
    0
  )
  const techStack = useMemo(
    () => (projectConfig?.tech_stack?.length ? projectConfig.tech_stack : (techImplPhase?.tech_stack ?? [])),
    [projectConfig, techImplPhase]
  )
  const conceptName = conceptPhase?.project_name?.trim() || ''
  const conceptDescription = conceptPhase?.description?.trim() || ''
  const conceptTargetUsers = conceptPhase?.target_users?.trim() || ''
  const uiPageCount = uiPagesPhase?.pages?.length ?? 0
  const conflictCount = status?.conflicts.length ?? 0
  const currentPhase = status?.current_phase || (phaseResults.at(-1)?.phase ?? '')
  const overallProgress = status?.overall_progress ?? 0
  const persistedFieldSources = useMemo(() => {
    return Object.fromEntries(
      Object.entries(fieldSourceRegistry.fields).map(([fieldKey, records]) => [
        fieldKey,
        records
          .slice(-2)
          .reverse()
          .map((record) => formatImportSourceLabel(record.source_label, record.merge_action)),
      ])
    ) as Record<string, string[]>
  }, [fieldSourceRegistry])
  const recentImports = useMemo(
    () => importManifest.imports.slice(-3).reverse(),
    [importManifest]
  )

  const overviewSections = useMemo<OverviewSection[]>(() => {
    const docsById = new Map(matchedDocs.map((entry) => [entry.definition.id, entry.docs]))
    const charterDocs = docsById.get('project-charter') ?? []
    const prdDocs = docsById.get('product-requirements') ?? []
    const uxDocs = docsById.get('ux-spec') ?? []
    const systemDesignDocs = docsById.get('system-design') ?? []
    const adrDocs = docsById.get('adr-log') ?? []
    const executionDocs = docsById.get('execution-plan') ?? []
    const qaDocs = docsById.get('qa-acceptance') ?? []
    const releaseDocs = docsById.get('release-operations') ?? []
    const retrospectiveDocs = docsById.get('retrospective') ?? []

    const projectNameCandidates = uniqueNonEmpty([
      projectConfig?.name,
      projectName,
      conceptName,
    ])
    const resolvedProjectName = projectNameCandidates[0] || ''
    const resolvedProjectDescription = uniqueNonEmpty([
      projectConfig?.description,
      projectDescription,
      conceptDescription,
    ])[0] || ''
    const projectNameConflict = hasConflictingText(projectNameCandidates)
    const techStackConflict = haveSetConflict(projectConfig?.tech_stack ?? [], techImplPhase?.tech_stack ?? [])

    const sections: OverviewSection[] = [
      {
        key: 'foundation',
        title: '立项与范围',
        description: '先确认项目是什么、给谁做、边界在哪里。',
        fields: [
          {
            key: 'project-definition',
            label: '项目定义',
            status: projectNameConflict
              ? 'conflict'
              : resolvedProjectName && resolvedProjectDescription
                ? 'confirmed'
                : resolvedProjectName || resolvedProjectDescription || charterDocs.length > 0 || Boolean(conceptPhase)
                  ? 'partial'
                  : 'missing',
            value: resolvedProjectName
              ? `${resolvedProjectName}${resolvedProjectDescription ? ` · ${truncateText(resolvedProjectDescription, 56)}` : ''}`
              : charterDocs.length > 0
                ? '已发现项目章程，但核心定义尚未固化'
                : '尚未定义',
            detail: projectNameConflict
              ? `项目名称来源不一致：${projectNameCandidates.join(' / ')}`
              : resolvedProjectName && resolvedProjectDescription
                ? '项目名称和描述已经进入内部结构化层。'
                : charterDocs.length > 0 || conceptPhase
                  ? '已有章程或概念结果，但问题定义/目标/非目标还不稳定。'
                  : '建议先补齐项目章程，再继续后续规划。',
            sources: uniqueNonEmpty([
              (projectConfig?.name || projectConfig?.description) ? '结构化项目配置' : null,
              (projectName || projectDescription) ? '看板当前状态' : null,
              conceptPhase ? 'Guide/概念阶段' : null,
              formatDocSource('项目章程', charterDocs),
            ]),
            gap: projectNameConflict
              ? '统一项目名称来源，避免项目定义在配置、看板和概念阶段之间分叉。'
              : '补齐项目章程中的问题定义、目标和非目标，并把它们固化到结构化配置中。',
          },
          {
            key: 'target-users',
            label: '目标用户',
            status: conceptTargetUsers
              ? 'confirmed'
              : charterDocs.length > 0 || Boolean(conceptPhase)
                ? 'partial'
                : 'missing',
            value: conceptTargetUsers || (charterDocs.length > 0 ? '章程已存在，但目标用户尚未结构化' : '尚未确认'),
            detail: conceptTargetUsers
              ? '目标用户已经被提炼成独立字段。'
              : charterDocs.length > 0
                ? '文档里大概率已有描述，但还没有形成稳定字段。'
                : '需要明确目标用户和核心场景，后续功能才不会漂移。',
            sources: uniqueNonEmpty([
              conceptTargetUsers ? 'Guide/概念阶段' : null,
              formatDocSource('项目章程', charterDocs),
            ]),
            gap: '把目标用户与核心场景整理成结构化字段，而不是只停留在文档段落里。',
          },
          {
            key: 'success-boundaries',
            label: '成功标准与范围边界',
            status: charterDocs.length > 0 || prdDocs.length > 0 ? 'partial' : 'missing',
            value: charterDocs.length > 0 || prdDocs.length > 0 ? '已发现章程/PRD，但成功标准与非目标未结构化' : '尚未定义',
            detail: charterDocs.length > 0 || prdDocs.length > 0
              ? '当前模型还没有 success metrics / non-goals 字段，只能看到文档覆盖。'
              : '项目总览还缺少“做到什么算成功”和“明确不做什么”。',
            sources: uniqueNonEmpty([
              formatDocSource('项目章程', charterDocs),
              formatDocSource('产品需求文档', prdDocs),
            ]),
            gap: '补充成功指标、非目标和范围边界，并为这些字段建立结构化槽位。',
          },
        ],
      },
      {
        key: 'requirements',
        title: '需求与体验',
        description: '把外部文档收敛成模块、页面和关键流程。',
        fields: [
          {
            key: 'feature-scope',
            label: '功能范围',
            status: featureModules.length > 0
              ? 'confirmed'
              : (featuresPhase?.modules.length ?? 0) > 0 || prdDocs.length > 0 || implementationModules.length > 0
                ? 'partial'
                : 'missing',
            value: featureModules.length > 0
              ? `${featureModules.length} 个功能模块`
              : (featuresPhase?.modules.length ?? 0) > 0
                ? `Guide 已识别 ${featuresPhase?.modules.length ?? 0} 个模块，尚未完全落盘`
                : implementationModules.length > 0
                  ? `${implementationModules.length} 个实现模块已存在，但功能层还没独立出来`
                  : prdDocs.length > 0
                    ? '已发现 PRD 文档'
                    : '尚未拆分',
            detail: featureModules.length > 0
              ? '需求已经进入功能模块层。'
              : implementationModules.length > 0
                ? '当前更像直接进入实现拆解，需求抽象层偏弱。'
                : '建议先用 PRD 或 features 阶段把范围收束成功能模块。',
            sources: uniqueNonEmpty([
              featureModules.length > 0 ? `.tmplan/feature-modules x${featureModules.length}` : null,
              (featuresPhase?.modules.length ?? 0) > 0 ? `Guide/功能阶段 x${featuresPhase?.modules.length ?? 0}` : null,
              implementationModules.length > 0 ? `.tmplan/implementation-modules x${implementationModules.length}` : null,
              formatDocSource('产品需求文档', prdDocs),
            ]),
            gap: '把需求先收敛成功能模块，再继续向实现任务拆解。',
          },
          {
            key: 'ui-pages',
            label: '页面与交互',
            status: uiPageCount > 0
              ? 'confirmed'
              : (uiPagesPhase?.pages.length ?? 0) > 0 || uxDocs.length > 0
                ? 'partial'
                : 'missing',
            value: uiPageCount > 0
              ? `${uiPageCount} 个页面/界面`
              : (uiPagesPhase?.pages.length ?? 0) > 0
                ? `Guide 已识别 ${uiPagesPhase?.pages.length ?? 0} 个页面，尚未完全固化`
                : uxDocs.length > 0
                  ? '已发现 UX / IA 文档'
                  : '尚未确认',
            detail: uiPageCount > 0
              ? '页面规划已经进入内部模型。'
              : uxDocs.length > 0
                ? '已有文档，但页面结构还没有变成结构化字段。'
                : '建议补齐页面清单、核心流程和信息架构。',
            sources: uniqueNonEmpty([
              uiPageCount > 0 ? `Guide/页面阶段 x${uiPageCount}` : null,
              formatDocSource('UX / IA 规范', uxDocs),
            ]),
            gap: '补充页面清单和关键交互流程，把设计信息从文档段落转成结构化字段。',
          },
        ],
      },
      {
        key: 'technology',
        title: '技术与决策',
        description: '技术栈、架构设计和关键决策要能落到结构化层。',
        fields: [
          {
            key: 'tech-stack',
            label: '技术栈',
            status: techStackConflict
              ? 'conflict'
              : techStack.length > 0
                ? 'confirmed'
                : systemDesignDocs.length > 0 || Boolean(techImplPhase) || implementationModules.length > 0
                  ? 'partial'
                  : 'missing',
            value: techStack.length > 0
              ? techStack.join(' / ')
              : systemDesignDocs.length > 0
                ? '已发现系统设计文档，但技术栈还未固化'
                : '尚未确认',
            detail: techStackConflict
              ? `项目配置与技术阶段的技术栈不一致：${projectConfig?.tech_stack?.join(' / ') || '未配置'} <> ${techImplPhase?.tech_stack?.join(' / ') || '未提取'}`
              : techStack.length > 0
                ? '技术栈已经进入结构化项目数据。'
                : '建议补齐 system design 或 tech-impl 结果，避免实现层自由发挥。',
            sources: uniqueNonEmpty([
              projectConfig?.tech_stack?.length ? '结构化项目配置' : null,
              techImplPhase?.tech_stack?.length ? 'Guide/技术阶段' : null,
              formatDocSource('系统设计', systemDesignDocs),
            ]),
            gap: techStackConflict
              ? '统一项目配置和技术阶段里的技术栈，避免后续实现依据不同版本。'
              : '明确技术栈，并把它固化到结构化配置和技术阶段结果里。',
          },
          {
            key: 'architecture',
            label: '架构与系统设计',
            status: systemDesignDocs.length > 0 && implementationModules.length > 0
              ? 'confirmed'
              : systemDesignDocs.length > 0 || implementationModules.length > 0
                ? 'partial'
                : 'missing',
            value: systemDesignDocs.length > 0
              ? `已发现系统设计文档${implementationModules.length > 0 ? `，关联 ${implementationModules.length} 个实现模块` : ''}`
              : implementationModules.length > 0
                ? `${implementationModules.length} 个实现模块已存在，但缺少系统设计文档`
                : '尚未建立',
            detail: systemDesignDocs.length > 0 && implementationModules.length > 0
              ? '架构说明和实现拆解已经形成对应关系。'
              : systemDesignDocs.length > 0
                ? '有架构文档，但模块拆解和架构映射还不够稳定。'
                : '建议在实现模块增长前先补齐系统设计文档。',
            sources: uniqueNonEmpty([
              implementationModules.length > 0 ? `.tmplan/implementation-modules x${implementationModules.length}` : null,
              formatDocSource('系统设计', systemDesignDocs),
            ]),
            gap: '补齐系统设计文档，并把实现模块与架构边界建立明确映射。',
          },
          {
            key: 'decisions',
            label: '决策记录',
            status: decisions.length > 0
              ? 'confirmed'
              : (techImplPhase?.decisions.length ?? 0) > 0 || adrDocs.length > 0
                ? 'partial'
                : 'missing',
            value: decisions.length > 0
              ? `${decisions.length} 条已落盘决策`
              : (techImplPhase?.decisions.length ?? 0) > 0
                ? `${techImplPhase?.decisions.length ?? 0} 条阶段决策待固化`
                : adrDocs.length > 0
                  ? '已发现 ADR 文档'
                  : '暂无记录',
            detail: decisions.length > 0
              ? '技术决策已经进入可追踪的结构化层。'
              : adrDocs.length > 0 || (techImplPhase?.decisions.length ?? 0) > 0
                ? '已有决策线索，但还没有全部沉淀成统一记录。'
                : '建议把关键技术选择写成 ADR 或结构化决策记录。',
            sources: uniqueNonEmpty([
              decisions.length > 0 ? `.tmplan/decisions x${decisions.length}` : null,
              (techImplPhase?.decisions.length ?? 0) > 0 ? `Guide/技术阶段 x${techImplPhase?.decisions.length ?? 0}` : null,
              formatDocSource('ADR 决策记录', adrDocs),
            ]),
            gap: '把关键技术选择固化成 ADR 或结构化决策记录，避免口头共识丢失。',
          },
        ],
      },
      {
        key: 'delivery',
        title: '执行与交付',
        description: '让计划、质量、发布和收尾形成闭环，而不是只停留在任务列表。',
        fields: [
          {
            key: 'execution-plan',
            label: '执行计划与任务拆解',
            status: implementationModules.length > 0 && taskCount > 0
              ? 'confirmed'
              : implementationModules.length > 0 || executionDocs.length > 0
                ? 'partial'
                : 'missing',
            value: implementationModules.length > 0
              ? `${implementationModules.length} 个实现模块 / ${taskCount} 个任务`
              : executionDocs.length > 0
                ? '已发现执行计划文档'
                : '尚未建立',
            detail: implementationModules.length > 0 && taskCount > 0
              ? '执行层已经形成模块和任务的双层结构。'
              : executionDocs.length > 0
                ? '已有计划文档，但还没有稳定落到结构化任务层。'
                : '建议补齐执行计划，并明确里程碑、依赖和资源安排。',
            sources: uniqueNonEmpty([
              implementationModules.length > 0 ? `.tmplan/implementation-modules x${implementationModules.length}` : null,
              taskCount > 0 ? `.tmplan/tasks x${taskCount}` : null,
              formatDocSource('执行计划', executionDocs),
            ]),
            gap: '把执行计划转成结构化模块、任务、依赖和里程碑。',
          },
          {
            key: 'milestones-risks',
            label: '阶段状态与风险',
            status: conflictCount > 0
              ? 'conflict'
              : currentPhase
                ? 'confirmed'
                : executionDocs.length > 0 || Boolean(status)
                  ? 'partial'
                  : 'missing',
            value: currentPhase
              ? `当前阶段：${currentPhase}${conflictCount > 0 ? ` · ${conflictCount} 个冲突` : overallProgress > 0 ? ` · 进度 ${overallProgress}%` : ''}`
              : executionDocs.length > 0 || status
                ? '已有状态上下文，但阶段信息不完整'
                : '尚未建立',
            detail: conflictCount > 0
              ? `当前存在 ${conflictCount} 个结构化冲突，需要人工确认。`
              : currentPhase
                ? '阶段状态已经可见，可以继续向里程碑和风险清单细化。'
                : '项目状态文件或执行计划还没有形成稳定的阶段视图。',
            sources: uniqueNonEmpty([
              status ? '.tmplan/status.json' : null,
              currentPhase ? `阶段/${currentPhase}` : null,
              executionDocs.length > 0 ? '执行计划文档' : null,
            ]),
            gap: conflictCount > 0
              ? `处理当前 ${conflictCount} 个结构化冲突，并统一阶段状态。`
              : '建立里程碑、风险和阶段状态的标准字段，而不是只保留粗粒度进度。',
          },
          {
            key: 'quality',
            label: '质量与验收',
            status: acceptanceCriteriaCount > 0
              ? 'confirmed'
              : taskCount > 0 || qaDocs.length > 0
                ? 'partial'
                : 'missing',
            value: acceptanceCriteriaCount > 0
              ? `${acceptanceCriteriaCount} 条验收标准`
              : qaDocs.length > 0
                ? '已发现质量与验收文档'
                : '尚未覆盖',
            detail: acceptanceCriteriaCount > 0
              ? '任务级验收标准已经建立。'
              : taskCount > 0
                ? '任务存在，但质量门槛还没有全部写清。'
                : '建议为功能和任务补齐质量策略与验收口径。',
            sources: uniqueNonEmpty([
              acceptanceCriteriaCount > 0 ? `.tmplan/acceptance-criteria x${acceptanceCriteriaCount}` : null,
              taskCount > 0 ? `.tmplan/tasks x${taskCount}` : null,
              formatDocSource('质量与验收计划', qaDocs),
            ]),
            gap: '为任务补齐验收标准，并建立质量计划和验收记录。',
          },
          {
            key: 'release-ops',
            label: '发布与运维',
            status: releaseDocs.length > 0 ? 'partial' : 'missing',
            value: releaseDocs.length > 0 ? '已发现发布与运维文档，尚未结构化' : '尚未规划',
            detail: releaseDocs.length > 0
              ? '目前只能感知到文档存在，还没有 release plan / rollback / runbook 字段。'
              : '上线前至少需要发布步骤、回滚方案和运行手册。',
            sources: uniqueNonEmpty([
              formatDocSource('发布与运维计划', releaseDocs),
            ]),
            gap: '补齐发布计划、回滚方案和运行手册，并为它们建立结构化槽位。',
          },
          {
            key: 'retrospective',
            label: '收尾与复盘',
            status: retrospectiveDocs.length > 0 && overallProgress >= 100
              ? 'confirmed'
              : retrospectiveDocs.length > 0
                ? 'partial'
                : 'missing',
            value: retrospectiveDocs.length > 0
              ? `已发现复盘文档${overallProgress >= 100 ? '，并且项目进度已完成' : ''}`
              : '尚未建立',
            detail: retrospectiveDocs.length > 0 && overallProgress >= 100
              ? '项目收尾材料已经具备。'
              : retrospectiveDocs.length > 0
                ? '复盘文档已存在，但项目状态还没有明确收尾。'
                : '建议在上线或阶段结束后沉淀复盘、遗留问题和后续路线图。',
            sources: uniqueNonEmpty([
              formatDocSource('项目复盘与收尾', retrospectiveDocs),
              overallProgress >= 100 ? '.tmplan/status.json' : null,
            ]),
            gap: '在项目结束时补齐复盘、遗留问题和后续路线图。',
          },
        ],
      },
    ]

    return sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({
        ...field,
        status: field.status === 'conflict'
          ? 'conflict'
          : fieldSourceRegistry.fields[field.key]?.at(-1)?.merge_action === 'conflict'
            ? 'conflict'
            : field.status,
        sources: uniqueNonEmpty([
          ...field.sources,
          ...(persistedFieldSources[field.key] ?? []),
        ]),
      })),
    }))
  }, [
    acceptanceCriteriaCount,
    conceptDescription,
    conceptName,
    conceptPhase,
    conceptTargetUsers,
    conflictCount,
    currentPhase,
    decisions.length,
    featureModules.length,
    featuresPhase,
    implementationModules.length,
    matchedDocs,
    overallProgress,
    projectConfig,
    projectDescription,
    projectName,
    status,
    taskCount,
    techStack,
    techImplPhase,
    uiPageCount,
    uiPagesPhase,
    persistedFieldSources,
    fieldSourceRegistry,
  ])

  const overviewFields = useMemo(
    () => overviewSections.flatMap((section) => section.fields),
    [overviewSections]
  )
  const totalFields = overviewFields.length
  const confirmedFields = overviewFields.filter((field) => field.status === 'confirmed').length
  const coveredFields = overviewFields.filter((field) => field.status !== 'missing').length
  const conflictFields = overviewFields.filter((field) => field.status === 'conflict').length
  const coveredDocs = matchedDocs.filter((entry) => entry.docs.length > 0).length
  const requiredDocs = matchedDocs.filter((entry) => entry.definition.required)
  const coveredRequiredDocs = requiredDocs.filter((entry) => entry.docs.length > 0).length

  const gapItems = useMemo(() => uniqueNonEmpty([
    ...overviewFields.filter((field) => field.status === 'conflict').map((field) => field.gap),
    ...overviewFields.filter((field) => field.status === 'missing').map((field) => field.gap),
    ...overviewFields.filter((field) => field.status === 'partial').map((field) => field.gap),
  ]), [overviewFields])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        正在整理项目总览...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-50">
            <CardTitle className="text-xl">{projectConfig?.name || projectName || conceptName || '未命名项目'}</CardTitle>
            <CardDescription className="text-slate-300">
              {projectConfig?.description || projectDescription || conceptDescription || '当前还没有稳定的项目定义描述，建议先补齐项目章程。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 bg-slate-50/70 px-6 py-4 md:grid-cols-2 xl:grid-cols-4 dark:bg-slate-950/20">
            <SummaryMetric
              icon={ClipboardList}
              label="标准字段"
              value={`${coveredFields} / ${totalFields}`}
              detail={`${confirmedFields} 个已确认 · ${conflictFields} 个冲突`}
            />
            <SummaryMetric
              icon={FileText}
              label="标准文档"
              value={`${coveredDocs} / ${matchedDocs.length}`}
              detail={`必需文档覆盖 ${coveredRequiredDocs} / ${requiredDocs.length}`}
            />
            <SummaryMetric
              icon={FolderKanban}
              label="结构化资产"
              value={`${implementationModules.length} 模块 / ${taskCount} 任务`}
              detail={`${decisions.length} 条决策 · ${projectDocs.length} 篇 Markdown`}
            />
            <SummaryMetric
              icon={AlertTriangle}
              label="当前风险"
              value={`${gapItems.length} 项待处理`}
              detail={conflictCount > 0 ? `${conflictCount} 个冲突待确认` : currentPhase ? `当前阶段：${currentPhase}` : '尚未建立阶段状态'}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>字段级总览</CardTitle>
              <CardDescription>项目总览现在按标准字段回答问题，并显式标出每个字段的来源。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              {overviewSections.map((section) => (
                <div key={section.key} className="rounded-2xl border bg-background/80 p-4">
                  <div className="mb-4">
                    <div className="text-sm font-semibold">{section.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                  </div>
                  <div className="space-y-3">
                    {section.fields.map((field) => (
                      <FieldCard key={field.key} field={field} />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>当前缺口</CardTitle>
                <CardDescription>这些项目字段还没填满，或者来源之间仍然冲突。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {gapItems.length > 0 ? gapItems.map((gap) => (
                  <div key={gap} className="flex items-start gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>{gap}</span>
                  </div>
                )) : (
                  <div className="flex items-start gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>当前标准字段已经基本闭环，可以继续细化执行细节和质量基线。</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-4">
              <CardHeader>
                <CardTitle>上下文来源</CardTitle>
                <CardDescription>字段状态当前引用的结构化和半结构化来源。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SourceRow icon={Users} label="Guide 阶段结果" value={guideProjectPath === projectPath ? `${phaseResults.length} 个阶段` : '当前项目无阶段上下文'} />
                <SourceRow icon={Layers3} label="结构化模块" value={`${modules.length} 个模块`} />
                <SourceRow icon={ShieldCheck} label="项目状态" value={status ? `冲突 ${conflictCount} 个 · 进度 ${overallProgress}%` : '暂无状态文件'} />
                <SourceRow icon={Rocket} label="项目文档" value={`${projectDocs.length} 篇 Markdown`} />
              </CardContent>
            </Card>

            <Card className="gap-4">
              <CardHeader>
                <CardTitle>最近导入</CardTitle>
                <CardDescription>最近几次“填空”写入了哪些字段，以及建议如何合并。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentImports.length > 0 ? recentImports.map((item) => (
                  <div key={item.import_id} className="rounded-lg border bg-background/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{item.project_name || '未命名导入'}</div>
                      <div className="text-[11px] text-muted-foreground">{formatImportTimestamp(item.imported_at)}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.source_files.length > 0 ? `${item.source_files.length} 篇文档` : '无外部文档'} · {item.field_keys.length} 个字段
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SourceTag label={`填空 ${item.merge_summary.filled}`} />
                      <SourceTag label={`补充 ${item.merge_summary.appended}`} />
                      <SourceTag label={`冲突 ${item.merge_summary.conflicts}`} />
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                    还没有持久化的导入记录。后续文档转换会在这里留下“填空历史”。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle>标准文档覆盖</CardTitle>
            <CardDescription>文档负责提供证据，内部标准字段负责承载稳定结构。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchedDocs.map(({ definition, docs }) => (
              <div key={definition.id} className="rounded-xl border bg-background/80 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{definition.title}</div>
                    <div className="text-xs text-muted-foreground">{definition.stage} · {definition.required ? '必需' : '建议'}</div>
                  </div>
                  <StatusPill status={getDocCoverageStatus(docs)} />
                </div>
                {docs.length > 0 ? (
                  <div className="space-y-1">
                    {docs.slice(0, 3).map((doc) => (
                      <div key={doc.path} className="truncate text-xs text-muted-foreground">{doc.path}</div>
                    ))}
                    {docs.length > 3 && (
                      <div className="text-xs text-muted-foreground">还有 {docs.length - 3} 篇匹配文档</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">尚未发现对应标准文档，建议按模板补齐。</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: SlotStatus }) {
  const meta = STATUS_META[status]

  return (
    <span className={cn('rounded-full px-2 py-1 text-[11px] font-medium', meta.className)}>
      {meta.label}
    </span>
  )
}

function SourceTag({ label }: { label: string }) {
  return (
    <span className="rounded-full border bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground">
      {label}
    </span>
  )
}

function FieldCard({ field }: { field: OverviewField }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{field.label}</span>
        <StatusPill status={field.status} />
      </div>
      <div className="mt-2 text-sm">{field.value}</div>
      {field.sources.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {field.sources.map((source) => (
            <SourceTag key={source} label={source} />
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">暂无可追踪来源</div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{field.detail}</p>
    </div>
  )
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border bg-white/85 p-4 dark:bg-slate-900/65">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function SourceRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/80 px-3 py-2">
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{value}</div>
      </div>
    </div>
  )
}
