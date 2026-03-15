import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import {
  ProjectConfigSchema,
  ModulePlanSchema,
  DecisionSchema,
  PhaseConfigSchema,
  ProjectStatusSchema,
} from '@/types/tmplan'
import {
  FieldSourceRegistrySchema,
  ImportManifestSchema,
} from '@/types/tmplan-imports'
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  PhaseConfig,
  ProjectStatus,
} from '@/types/tmplan'
import type {
  FieldSourceRegistry,
  ImportManifest,
} from '@/types/tmplan-imports'
import { validateSlug } from './validator'

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

async function readYaml<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  const raw = normalizeYamlValue(yaml.load(content))
  return schema.parse(raw)
}

async function readYamlOrDefault<T>(
  filePath: string,
  schema: z.ZodType<T>,
  fallback: T
): Promise<T> {
  try {
    return await readYaml(filePath, schema)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback
    }
    throw err
  }
}

export async function readProject(basePath: string): Promise<ProjectConfig> {
  try {
    return await readYaml(tmplanPath(basePath, 'project.yaml'), ProjectConfigSchema)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return readPlanProject(basePath)
    }
    throw err
  }
}

export async function readModule(
  basePath: string,
  moduleName: string
): Promise<ModulePlan> {
  if (!validateSlug(moduleName)) {
    throw new Error(`Invalid module name: "${moduleName}" is not a valid slug`)
  }
  return readYaml(
    tmplanPath(basePath, 'modules', `${moduleName}.yaml`),
    ModulePlanSchema
  )
}

async function readModuleFiles(dir: string): Promise<ModulePlan[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }

  const yamlFiles = files.filter((f) => f.endsWith('.yaml')).sort()
  return Promise.all(
    yamlFiles.map((f) => readYaml(join(dir, f), ModulePlanSchema))
  )
}

export async function readAllModules(basePath: string): Promise<ModulePlan[]> {
  const modules = await readModuleFiles(tmplanPath(basePath, 'modules'))
  if (modules.length > 0) {
    return modules
  }

  return readModuleFiles(tmplanPath(basePath, 'plans', 'modules'))
}

export async function readAllDecisions(
  basePath: string
): Promise<Decision[]> {
  const decisions = await readDecisionFiles(tmplanPath(basePath, 'decisions'))
  if (decisions.length > 0) {
    return decisions
  }

  return readDecisionFiles(tmplanPath(basePath, 'plans', 'decisions'))
}

export async function readPhases(basePath: string): Promise<PhaseConfig[]> {
  const dir = tmplanPath(basePath, 'phases')
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
  const yamlFiles = files
    .filter((f) => f.endsWith('.yaml'))
    .sort()
  const phases = await Promise.all(
    yamlFiles.map((f) => readYaml(join(dir, f), PhaseConfigSchema))
  )
  return phases.sort((a, b) => a.order - b.order)
}

// ---- Plans sub-directory (converted from docs) ----

export async function readPlanModules(basePath: string): Promise<ModulePlan[]> {
  const dir = tmplanPath(basePath, 'plans', 'modules')
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
  const yamlFiles = files.filter((f) => f.endsWith('.yaml')).sort()
  return Promise.all(
    yamlFiles.map((f) => readYaml(join(dir, f), ModulePlanSchema))
  )
}

export async function readPlanProject(basePath: string): Promise<ProjectConfig> {
  return readYaml(tmplanPath(basePath, 'plans', 'project.yaml'), ProjectConfigSchema)
}

async function readDecisionFiles(dir: string): Promise<Decision[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }

  const yamlFiles = files
    .filter((f) => f.endsWith('.yaml'))
    .sort()
  return Promise.all(
    yamlFiles.map((f) => readYaml(join(dir, f), DecisionSchema))
  )
}

export async function readStatus(basePath: string): Promise<ProjectStatus> {
  return readYaml(tmplanPath(basePath, 'status.yaml'), ProjectStatusSchema)
}

export async function readImportManifest(basePath: string): Promise<ImportManifest> {
  return readYamlOrDefault(
    tmplanPath(basePath, 'imports', 'manifest.yaml'),
    ImportManifestSchema,
    { imports: [] }
  )
}

export async function readFieldSourceRegistry(basePath: string): Promise<FieldSourceRegistry> {
  return readYamlOrDefault(
    tmplanPath(basePath, 'imports', 'field-sources.yaml'),
    FieldSourceRegistrySchema,
    { fields: {} }
  )
}
