import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAiGuideImportMetadata } from './import-records'

test('buildAiGuideImportMetadata marks matching guide save as append and new tech stack as fill', () => {
  const { importRecord, fieldRecords } = buildAiGuideImportMetadata({
    importId: 'ai-guide-001',
    recordedAt: '2026-03-14T00:00:00.000Z',
    existingProject: {
      schema_version: '1.0',
      name: 'TmPlan',
      description: '计划管理工具',
      tech_stack: [],
      created_at: '2026-03-13T00:00:00.000Z',
      updated_at: '2026-03-13T00:00:00.000Z',
    },
    existingModules: [
      {
        module: '项目看板',
        slug: 'project-board',
      },
    ],
    existingDecisions: [],
    planResult: {
      projectName: 'TmPlan',
      description: '计划管理工具',
      techStack: ['Next.js', 'Tauri'],
      modules: [
        {
          module: '项目看板',
          slug: 'project-board',
          tasks: [{ id: 'project-board-01' }],
        },
      ],
      decisions: [],
    },
  })

  assert.equal(importRecord.source_type, 'ai-guide')
  assert.equal(importRecord.merge_summary.appended, 3)
  assert.equal(importRecord.merge_summary.filled, 1)
  assert.equal(fieldRecords.find((record) => record.field_key === 'project-definition')?.merge_action, 'append')
  assert.equal(fieldRecords.find((record) => record.field_key === 'execution-plan')?.merge_action, 'append')
  assert.equal(fieldRecords.find((record) => record.field_key === 'tech-stack')?.merge_action, 'fill')
})
