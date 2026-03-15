import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readAllDecisions, readAllModules, readProject } from './reader'

test('readAllModules falls back to .tmplan/plans/modules when .tmplan/modules is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-reader-'))

  try {
    const plansModulesDir = join(root, '.tmplan', 'plans', 'modules')
    await mkdir(plansModulesDir, { recursive: true })
    await writeFile(
      join(plansModulesDir, 'feature-a.yaml'),
      [
        'module: Feature A',
        'slug: feature-a',
        'layer: implementation',
        'status: pending',
        'priority: medium',
        'depends_on: []',
        'decision_refs: []',
        'overview: Example module',
        'estimated_hours: null',
        'created_at: 2026-03-13T00:00:00.000Z',
        'updated_at: 2026-03-13T00:00:00.000Z',
        'tasks:',
        '  - id: feature-a-01',
        '    title: First task',
        '    status: pending',
        '    depends_on: []',
        '    detail: do something',
        '    files_to_create: []',
        '    files_to_modify: []',
        '    acceptance_criteria: []',
      ].join('\n'),
      'utf-8'
    )

    const modules = await readAllModules(root)

    assert.equal(modules.length, 1)
    assert.equal(modules[0]?.slug, 'feature-a')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('readProject falls back to .tmplan/plans/project.yaml when .tmplan/project.yaml is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-reader-'))

  try {
    const plansDir = join(root, '.tmplan', 'plans')
    await mkdir(plansDir, { recursive: true })
    await writeFile(
      join(plansDir, 'project.yaml'),
      [
        'schema_version: "1.0"',
        'name: Planned Project',
        'description: from plans project',
        'tech_stack: []',
        'created_at: 2026-03-16T00:00:00.000Z',
        'updated_at: 2026-03-16T00:00:00.000Z',
      ].join('\n'),
      'utf-8'
    )

    const project = await readProject(root)

    assert.equal(project.name, 'Planned Project')
    assert.equal(project.description, 'from plans project')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('readAllDecisions falls back to .tmplan/plans/decisions when .tmplan/decisions is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-reader-'))

  try {
    const plansDecisionsDir = join(root, '.tmplan', 'plans', 'decisions')
    await mkdir(plansDecisionsDir, { recursive: true })
    await writeFile(
      join(plansDecisionsDir, '001-use-cache.yaml'),
      [
        'decision_id: 1',
        'question: Use cache?',
        'context: import from plan decisions',
        'options_presented: []',
        'chosen: yes',
        'reason: performance',
        'impact: []',
        'affected_modules: []',
        'decided_at: 2026-03-16T00:00:00.000Z',
        'supersedes: null',
      ].join('\n'),
      'utf-8'
    )

    const decisions = await readAllDecisions(root)

    assert.equal(decisions.length, 1)
    assert.equal(decisions[0]?.decision_id, 1)
    assert.equal(decisions[0]?.chosen, 'yes')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
