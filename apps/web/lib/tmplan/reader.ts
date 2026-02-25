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
import type {
  ProjectConfig,
  ModulePlan,
  Decision,
  PhaseConfig,
  ProjectStatus,
} from '@/types/tmplan'
import { validateSlug } from './validator'

const TMPLAN_DIR = '.tmplan'

function tmplanPath(basePath: string, ...segments: string[]): string {
  return join(basePath, TMPLAN_DIR, ...segments)
}

async function readYaml<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  const raw = yaml.load(content)
  return schema.parse(raw)
}

export async function readProject(basePath: string): Promise<ProjectConfig> {
  return readYaml(tmplanPath(basePath, 'project.yaml'), ProjectConfigSchema)
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

export async function readAllModules(basePath: string): Promise<ModulePlan[]> {
  const dir = tmplanPath(basePath, 'modules')
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

export async function readAllDecisions(
  basePath: string
): Promise<Decision[]> {
  const dir = tmplanPath(basePath, 'decisions')
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

export async function readStatus(basePath: string): Promise<ProjectStatus> {
  return readYaml(tmplanPath(basePath, 'status.yaml'), ProjectStatusSchema)
}
