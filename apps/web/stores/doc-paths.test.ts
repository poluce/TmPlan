import test from 'node:test'
import assert from 'node:assert/strict'

import { createDefaultDocPaths, migrateDocPaths } from './doc-paths'

test('migrateDocPaths upgrades legacy docs-only config to project root scanning', () => {
  assert.deepEqual(
    migrateDocPaths([{ path: 'docs', enabled: true }], 3),
    createDefaultDocPaths()
  )
})

test('migrateDocPaths preserves custom doc path configuration', () => {
  assert.deepEqual(
    migrateDocPaths(
      [
        { path: '.', enabled: true },
        { path: 'wiki', enabled: false },
      ],
      3
    ),
    [
      { path: '.', enabled: true },
      { path: 'wiki', enabled: false },
    ]
  )
})
