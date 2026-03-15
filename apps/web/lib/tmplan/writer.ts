import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  PhaseConfig,
  ProjectStatus,
} from '@/types/tmplan'
import type {
  FieldSourceRecord,
  FieldSourceRegistry,
  ImportManifest,
  ImportRecord,
} from '@/types/tmplan-imports'
import {
  FieldSourceRegistrySchema,
  ImportManifestSchema,
} from '@/types/tmplan-imports'

const TMPLAN_DIR = '.tmplan'

function tmplanPath(basePath: string, ...segments: string[]): string {
  return join(basePath, TMPLAN_DIR, ...segments)
}

function normalizeYamlValue<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeYamlValue(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeYamlValue(entry)])
    ) as T
  }

  return value
}

async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  })
  await writeFile(filePath, content, 'utf-8')
}

function isErrnoCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code
}

async function readYamlOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const raw = normalizeYamlValue(yaml.load(content))
    return raw as T
  } catch (err: unknown) {
    if (isErrnoCode(err, 'ENOENT')) {
      return fallback
    }
    throw err
  }
}

async function writeYamlIfMissing(filePath: string, data: unknown): Promise<void> {
  try {
    await readFile(filePath, 'utf-8')
  } catch (err: unknown) {
    if (!isErrnoCode(err, 'ENOENT')) {
      throw err
    }

    await writeYaml(filePath, data)
  }
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

export function getDecisionFileName(decision: Decision): string {
  return `${String(decision.decision_id).padStart(3, '0')}-${decision.question
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+$/, '')
    .toLowerCase()}.yaml`
}

function orderImportManifest(manifest: ImportManifest) {
  return {
    imports: manifest.imports.map((record) => ({
      import_id: record.import_id,
      imported_at: record.imported_at,
      source_type: record.source_type,
      source_files: record.source_files,
      field_keys: record.field_keys,
      project_name: record.project_name,
      modules_imported: record.modules_imported,
      decisions_imported: record.decisions_imported,
      merge_summary: {
        filled: record.merge_summary.filled,
        replaced: record.merge_summary.replaced,
        appended: record.merge_summary.appended,
        conflicts: record.merge_summary.conflicts,
        staged: record.merge_summary.staged,
      },
    })),
  }
}

function orderFieldSourceRegistry(registry: FieldSourceRegistry) {
  const orderedFields = Object.fromEntries(
    Object.entries(registry.fields)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([fieldKey, records]) => [
        fieldKey,
        records.map((record) => ({
          field_key: record.field_key,
          source_type: record.source_type,
          source_label: record.source_label,
          source_files: record.source_files,
          import_id: record.import_id,
          recorded_at: record.recorded_at,
          merge_action: record.merge_action,
          value_preview: record.value_preview,
        })),
      ])
  )

  return {
    fields: orderedFields,
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
  await writeYaml(join(dir, getDecisionFileName(decision)), orderDecision(decision))
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

export async function appendImportRecord(
  basePath: string,
  record: ImportRecord
): Promise<void> {
  const dir = tmplanPath(basePath, 'imports')
  await mkdir(dir, { recursive: true })

  const manifestPath = join(dir, 'manifest.yaml')
  const manifest = ImportManifestSchema.parse(
    await readYamlOrDefault<ImportManifest>(manifestPath, { imports: [] })
  )
  manifest.imports.push(record)

  await writeYaml(manifestPath, orderImportManifest(manifest))
}

export async function appendImportMetadata(
  basePath: string,
  record: ImportRecord,
  fieldRecords: FieldSourceRecord[]
): Promise<void> {
  const dir = tmplanPath(basePath, 'imports')
  await mkdir(dir, { recursive: true })

  const manifestPath = join(dir, 'manifest.yaml')
  const registryPath = join(dir, 'field-sources.yaml')

  const currentManifest = ImportManifestSchema.parse(
    await readYamlOrDefault<ImportManifest>(manifestPath, { imports: [] })
  )
  const currentRegistry = FieldSourceRegistrySchema.parse(
    await readYamlOrDefault<FieldSourceRegistry>(registryPath, { fields: {} })
  )

  const nextManifest: ImportManifest = {
    imports: [...currentManifest.imports, record],
  }
  const nextRegistry: FieldSourceRegistry = {
    fields: { ...currentRegistry.fields },
  }

  for (const fieldRecord of fieldRecords) {
    const existing = nextRegistry.fields[fieldRecord.field_key] ?? []
    nextRegistry.fields[fieldRecord.field_key] = [...existing, fieldRecord].slice(-20)
  }

  const hadRegistryFile = await readFile(registryPath, 'utf-8')
    .then(() => true)
    .catch((err: unknown) => {
      if (isErrnoCode(err, 'ENOENT')) return false
      throw err
    })

  try {
    if (fieldRecords.length > 0) {
      await writeYaml(registryPath, orderFieldSourceRegistry(nextRegistry))
    }
    await writeYaml(manifestPath, orderImportManifest(nextManifest))
  } catch (err) {
    if (fieldRecords.length > 0) {
      try {
        if (hadRegistryFile) {
          await writeYaml(registryPath, orderFieldSourceRegistry(currentRegistry))
        } else {
          await unlink(registryPath).catch((unlinkError) => {
            if (!isErrnoCode(unlinkError, 'ENOENT')) {
              throw unlinkError
            }
          })
        }
      } catch {
        // Keep the original write error; best-effort rollback is enough here.
      }
    }
    throw err
  }
}

export async function appendFieldSourceRecords(
  basePath: string,
  records: FieldSourceRecord[]
): Promise<void> {
  if (records.length === 0) return

  const dir = tmplanPath(basePath, 'imports')
  await mkdir(dir, { recursive: true })

  const registryPath = join(dir, 'field-sources.yaml')
  const registry = FieldSourceRegistrySchema.parse(
    await readYamlOrDefault<FieldSourceRegistry>(registryPath, { fields: {} })
  )

  for (const record of records) {
    const existing = registry.fields[record.field_key] ?? []
    registry.fields[record.field_key] = [...existing, record].slice(-20)
  }

  await writeYaml(registryPath, orderFieldSourceRegistry(registry))
}

async function removeYamlFilesExcept(dir: string, keepFileNames: Set<string>): Promise<void> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    if (isErrnoCode(err, 'ENOENT')) {
      return
    }
    throw err
  }

  await Promise.all(
    files
      .filter((fileName) => fileName.endsWith('.yaml') && !keepFileNames.has(fileName))
      .map((fileName) => unlink(join(dir, fileName)))
  )
}

export async function removeStaleModuleFiles(basePath: string, moduleSlugs: string[]): Promise<void> {
  const keepFileNames = new Set(moduleSlugs.map((slug) => `${slug}.yaml`))
  await removeYamlFilesExcept(tmplanPath(basePath, 'modules'), keepFileNames)
}

export async function removeStaleDecisionFiles(basePath: string, decisions: Decision[]): Promise<void> {
  const keepFileNames = new Set(decisions.map((decision) => getDecisionFileName(decision)))
  await removeYamlFilesExcept(tmplanPath(basePath, 'decisions'), keepFileNames)
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
  await writeYaml(join(dir, getDecisionFileName(decision)), orderDecision(decision))
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
  const dirs = ['', 'modules', 'decisions', 'phases', 'imports']
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
  await writeYamlIfMissing(tmplanPath(basePath, 'project.yaml'), orderProjectConfig(project))

  const status: ProjectStatus = {
    overall_progress: 0,
    current_phase: '',
    modules_status: {},
    last_check_at: now,
    updated_at: now,
    conflicts: [],
  }
  await writeYamlIfMissing(tmplanPath(basePath, 'status.yaml'), orderProjectStatus(status))
}
