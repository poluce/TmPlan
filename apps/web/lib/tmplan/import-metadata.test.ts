import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readFieldSourceRegistry, readImportManifest } from './reader'
import { appendImportMetadata, initTmplan } from './writer'

test('import metadata round-trips through manifest and field source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-imports-'))

  try {
    await initTmplan(root)

    await appendImportMetadata(root, {
      import_id: 'import-001',
      imported_at: '2026-03-14T00:00:00.000Z',
      source_type: 'doc-convert',
      source_files: ['docs/prd.md', 'docs/system-design.md'],
      field_keys: ['project-definition', 'execution-plan'],
      project_name: '示例项目',
      modules_imported: ['core-flow'],
      decisions_imported: [1],
      merge_summary: {
        filled: 1,
        replaced: 0,
        appended: 1,
        conflicts: 0,
        staged: 0,
      },
    }, [
      {
        field_key: 'project-definition',
        source_type: 'doc-convert',
        source_label: '文档转换/prd.md, system-design.md',
        source_files: ['docs/prd.md', 'docs/system-design.md'],
        import_id: 'import-001',
        recorded_at: '2026-03-14T00:00:00.000Z',
        merge_action: 'fill',
        value_preview: '示例项目 · 用于验证导入元数据',
      },
      {
        field_key: 'execution-plan',
        source_type: 'doc-convert',
        source_label: '文档转换/prd.md, system-design.md',
        source_files: ['docs/prd.md', 'docs/system-design.md'],
        import_id: 'import-001',
        recorded_at: '2026-03-14T00:00:00.000Z',
        merge_action: 'append',
        value_preview: '1 个模块 / 3 个任务',
      },
    ])

    const manifest = await readImportManifest(root)
    const fieldSources = await readFieldSourceRegistry(root)

    assert.equal(manifest.imports.length, 1)
    assert.equal(manifest.imports[0]?.project_name, '示例项目')
    assert.deepEqual(manifest.imports[0]?.field_keys, ['project-definition', 'execution-plan'])
    assert.equal(fieldSources.fields['project-definition']?.length, 1)
    assert.equal(fieldSources.fields['project-definition']?.[0]?.merge_action, 'fill')
    assert.equal(fieldSources.fields['execution-plan']?.[0]?.value_preview, '1 个模块 / 3 个任务')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('initTmplan preserves existing project and status files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-init-'))

  try {
    const tmplanDir = join(root, '.tmplan')
    await initTmplan(root)

    await writeFile(
      join(tmplanDir, 'project.yaml'),
      [
        'schema_version: "1.0"',
        'name: Existing Project',
        'description: Keep me',
        'tech_stack: []',
        'created_at: existing-created',
        'updated_at: existing-updated',
      ].join('\n'),
      'utf-8'
    )
    await writeFile(
      join(tmplanDir, 'status.yaml'),
      [
        'overall_progress: 42',
        'current_phase: delivery',
        'modules_status: {}',
        'last_check_at: existing-last-check',
        'updated_at: existing-status-updated',
        'conflicts: []',
      ].join('\n'),
      'utf-8'
    )

    await initTmplan(root)

    const [projectContent, statusContent] = await Promise.all([
      readFile(join(tmplanDir, 'project.yaml'), 'utf-8'),
      readFile(join(tmplanDir, 'status.yaml'), 'utf-8'),
    ])

    assert.match(projectContent, /Existing Project/)
    assert.match(projectContent, /existing-created/)
    assert.match(statusContent, /delivery/)
    assert.match(statusContent, /existing-status-updated/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
