import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appendServerLog, getServerLogFilePath } from './server-logger.ts'

test('getServerLogFilePath creates module subdirectory with daily log filename', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-logs-'))

  try {
    const filePath = await getServerLogFilePath('convert', {
      logsRoot: root,
      now: new Date('2026-03-13T10:00:00.000Z'),
    })

    assert.equal(filePath, join(root, 'convert', '2026-03-13.log'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('appendServerLog writes json line into module daily log file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-logs-'))

  try {
    await appendServerLog({
      module: 'convert',
      level: 'info',
      event: 'Convert request received',
      metadata: { traceId: 'trace-1', docsCount: 2 },
      logsRoot: root,
      now: new Date('2026-03-13T10:00:00.000Z'),
    })

    const filePath = join(root, 'convert', '2026-03-13.log')
    const content = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content.trim())

    assert.equal(parsed.level, 'info')
    assert.equal(parsed.module, 'convert')
    assert.equal(parsed.event, 'Convert request received')
    assert.deepEqual(parsed.metadata, { traceId: 'trace-1', docsCount: 2 })
    assert.equal(parsed.timestamp, '2026-03-13T10:00:00.000Z')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('appendServerLog rejects invalid module names', async () => {
  await assert.rejects(
    () => appendServerLog({
      module: '../bad',
      level: 'error',
      event: 'bad',
      metadata: {},
      logsRoot: join(tmpdir(), 'tmplan-logs-invalid'),
      now: new Date('2026-03-13T10:00:00.000Z'),
    }),
    /Invalid log module/
  )
})
