import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { changeTaskStatus } from './operations'
import { readModule, readStatus } from './reader'
import { initTmplan, writeModule } from './writer'
import type { ModulePlan } from '@/types/tmplan'

test('changeTaskStatus updates module status and syncs project status', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-operations-'))
  const now = '2026-03-15T00:00:00.000Z'

  try {
    await initTmplan(root)

    const modulePlan: ModulePlan = {
      module: '项目总览',
      slug: 'project-overview',
      layer: 'implementation',
      status: 'pending',
      priority: 'medium',
      depends_on: [],
      decision_refs: [],
      overview: '示例模块',
      estimated_hours: null,
      created_at: now,
      updated_at: now,
      tasks: [
        {
          id: 'project-overview-01',
          title: '完成总览',
          status: 'pending',
          depends_on: [],
          detail: '写完总览',
          files_to_create: [],
          files_to_modify: [],
          acceptance_criteria: [],
        },
      ],
    }

    await writeModule(root, modulePlan)
    await changeTaskStatus(root, 'project-overview', 'project-overview-01', 'completed')

    const [updatedModule, status] = await Promise.all([
      readModule(root, 'project-overview'),
      readStatus(root),
    ])

    assert.equal(updatedModule.status, 'completed')
    assert.equal(updatedModule.tasks[0]?.status, 'completed')
    assert.equal(status.overall_progress, 100)
    assert.equal(status.modules_status['project-overview'], 'completed')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
