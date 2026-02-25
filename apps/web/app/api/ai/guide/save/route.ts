import { NextRequest, NextResponse } from 'next/server'
import {
  writeProject,
  writeModule,
  writeDecision,
  initTmplan,
} from '@/lib/tmplan'
import type { ProjectConfig, ModulePlan, Decision } from '@/types/tmplan'

interface PlanResult {
  projectName: string
  description: string
  techStack: string[]
  modules: Array<{
    module: string
    slug: string
    overview: string
    priority?: string
    depends_on: string[]
    layer?: 'feature' | 'implementation'
    tasks: Array<{
      id: string
      title: string
      detail: string
      depends_on: string[]
      files_to_create: string[]
      files_to_modify: string[]
      acceptance_criteria: string[]
    }>
  }>
  decisions: Array<{
    decision_id: number
    question: string
    chosen: string
    reason: string
  }>
}

interface RequestBody {
  projectPath: string
  planResult: PlanResult
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { projectPath, planResult } = body

    if (!projectPath || !planResult) {
      return NextResponse.json(
        { error: '缺少 projectPath 或 planResult' },
        { status: 400 }
      )
    }

    // Initialize .tmplan directory
    await initTmplan(projectPath)

    const now = new Date().toISOString()

    // Write project config
    const projectConfig: ProjectConfig = {
      schema_version: '1.0',
      name: planResult.projectName,
      description: planResult.description,
      tech_stack: planResult.techStack,
      created_at: now,
      updated_at: now,
    }
    await writeProject(projectPath, projectConfig)

    // Write modules (both feature and implementation layers)
    for (const mod of planResult.modules) {
      // Determine layer: modules without tasks are feature layer
      const layer = mod.layer || (mod.tasks && mod.tasks.length > 0 ? 'implementation' : 'feature')

      const modulePlan: ModulePlan = {
        module: mod.module,
        slug: mod.slug,
        layer,
        status: 'pending',
        depends_on: mod.depends_on || [],
        decision_refs: [],
        overview: mod.overview,
        priority: (mod.priority as any) || 'medium',
        estimated_hours: null,
        created_at: now,
        updated_at: now,
        tasks: (mod.tasks || []).map((t) => ({
          id: t.id,
          title: t.title,
          status: 'pending' as const,
          depends_on: t.depends_on || [],
          detail: t.detail,
          files_to_create: t.files_to_create || [],
          files_to_modify: t.files_to_modify || [],
          acceptance_criteria: t.acceptance_criteria || [],
        })),
      }
      await writeModule(projectPath, modulePlan)
    }

    // Write decisions
    for (const dec of planResult.decisions) {
      const decision: Decision = {
        decision_id: dec.decision_id,
        question: dec.question,
        context: '',
        options_presented: [],
        chosen: dec.chosen,
        reason: dec.reason,
        impact: [],
        affected_modules: [],
        decided_at: now,
        supersedes: null,
      }
      await writeDecision(projectPath, decision)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '保存失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
