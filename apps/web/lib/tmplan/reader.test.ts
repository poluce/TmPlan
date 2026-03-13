import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readAllModules } from './reader.ts'

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
