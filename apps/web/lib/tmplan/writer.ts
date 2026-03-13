import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  PhaseConfig,
  ProjectStatus,
} from '@/types/tmplan'

const TMPLAN_DIR = '.tmplan'

function tmplanPath(basePath: string, ...segments: string[]): string {
  return join(basePath, TMPLAN_DIR, ...segments)
}

async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  })
  await writeFile(filePath, content, 'utf-8')
}

function orderProjectConfig(config: ProjectConfig) {
  return {
    schema_version: config.schema_version,
    name: config.name,
    description: config.description,
    tech_stack: config.tech_stack,
    created_at: config.created_at,
    updated_at: config.updated_at,
  }
}

function orderModulePlan(plan: ModulePlan) {
  return {
    module: plan.module,
    slug: plan.slug,
    layer: plan.layer ?? 'implementation',
    status: plan.status,
    priority: plan.priority,
    depends_on: plan.depends_on,
    decision_refs: plan.decision_refs,
    overview: plan.overview,
    estimated_hours: plan.estimated_hours,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    tasks: plan.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      depends_on: t.depends_on,
      detail: t.detail,
      files_to_create: t.files_to_create,
      files_to_modify: t.files_to_modify,
      acceptance_criteria: t.acceptance_criteria,
    })),
  }
}

function orderDecision(dec: Decision) {
  return {
    decision_id: dec.decision_id,
    question: dec.question,
    context: dec.context,
    options_presented: dec.options_presented,
    chosen: dec.chosen,
    reason: dec.reason,
    impact: dec.impact,
    affected_modules: dec.affected_modules,
    decided_at: dec.decided_at,
    supersedes: dec.supersedes,
  }
}

function orderPhaseConfig(phase: PhaseConfig) {
  return {
    phase: phase.phase,
    slug: phase.slug,
    order: phase.order,
    description: phase.description,
    modules: phase.modules,
    status: phase.status,
  }
}

function orderProjectStatus(status: ProjectStatus) {
  return {
    overall_progress: status.overall_progress,
    current_phase: status.current_phase,
    modules_status: status.modules_status,
    last_check_at: status.last_check_at,
    updated_at: status.updated_at,
    conflicts: status.conflicts,
  }
}

export async function writeProject(
  basePath: string,
  config: ProjectConfig
): Promise<void> {
  await writeYaml(tmplanPath(basePath, 'project.yaml'), orderProjectConfig(config))
}

export async function writeModule(
  basePath: string,
  plan: ModulePlan
): Promise<void> {
  const dir = tmplanPath(basePath, 'modules')
  await mkdir(dir, { recursive: true })
  await writeYaml(join(dir, `${plan.slug}.yaml`), orderModulePlan(plan))
}

export async function writeDecision(
  basePath: string,
  decision: Decision
): Promise<void> {
  const dir = tmplanPath(basePath, 'decisions')
  await mkdir(dir, { recursive: true })
  const fileName = `${String(decision.decision_id).padStart(3, '0')}-${decision.question
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .toLowerCase()}.yaml`
  await writeYaml(join(dir, fileName), orderDecision(decision))
}

export async function writePhase(
  basePath: string,
  phase: PhaseConfig
): Promise<void> {
  const dir = tmplanPath(basePath, 'phases')
  await mkdir(dir, { recursive: true })
  const fileName = `phase-${phase.order}-${phase.slug}.yaml`
  await writeYaml(join(dir, fileName), orderPhaseConfig(phase))
}

export async function updateStatus(
  basePath: string,
  status: ProjectStatus
): Promise<void> {
  await writeYaml(tmplanPath(basePath, 'status.yaml'), orderProjectStatus(status))
}

// ---- Plans sub-directory (converted from docs) ----

export async function initPlansDir(basePath: string): Promise<void> {
  const dirs = ['plans', 'plans/modules', 'plans/decisions', '.cache']
  for (const dir of dirs) {
    await mkdir(tmplanPath(basePath, dir), { recursive: true })
  }
}

export async function writePlanProject(
  basePath: string,
  config: ProjectConfig
): Promise<void> {
  const dir = tmplanPath(basePath, 'plans')
  await mkdir(dir, { recursive: true })
  await writeYaml(join(dir, 'project.yaml'), orderProjectConfig(config))
}

export async function writePlanModule(
  basePath: string,
  plan: ModulePlan
): Promise<void> {
  const dir = tmplanPath(basePath, 'plans', 'modules')
  await mkdir(dir, { recursive: true })
  await writeYaml(join(dir, `${plan.slug}.yaml`), orderModulePlan(plan))
}

export async function writePlanDecision(
  basePath: string,
  decision: Decision
): Promise<void> {
  const dir = tmplanPath(basePath, 'plans', 'decisions')
  await mkdir(dir, { recursive: true })
  const fileName = `${String(decision.decision_id).padStart(3, '0')}-${decision.question
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .toLowerCase()}.yaml`
  await writeYaml(join(dir, fileName), orderDecision(decision))
}

export async function writePlanCache(
  basePath: string,
  key: string,
  data: unknown
): Promise<void> {
  const dir = tmplanPath(basePath, '.cache')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${key}.json`), JSON.stringify(data, null, 2), 'utf-8')
}

export async function initTmplan(basePath: string): Promise<void> {
  const dirs = ['', 'modules', 'decisions', 'phases']
  for (const dir of dirs) {
    await mkdir(tmplanPath(basePath, dir), { recursive: true })
  }

  const now = new Date().toISOString()

  const project: ProjectConfig = {
    schema_version: '1.0',
    name: '',
    description: '',
    tech_stack: [],
    created_at: now,
    updated_at: now,
  }
  await writeYaml(tmplanPath(basePath, 'project.yaml'), orderProjectConfig(project))

  const status: ProjectStatus = {
    overall_progress: 0,
    current_phase: '',
    modules_status: {},
    last_check_at: now,
    updated_at: now,
    conflicts: [],
  }
  await writeYaml(tmplanPath(basePath, 'status.yaml'), orderProjectStatus(status))
}
