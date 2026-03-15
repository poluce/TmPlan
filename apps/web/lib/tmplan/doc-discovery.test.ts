import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { collectMarkdownDocs } from './doc-discovery'

test('collectMarkdownDocs recursively finds project markdown files and skips excluded directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tmplan-docs-'))

  try {
    await mkdir(join(root, 'docs', 'nested'), { recursive: true })
    await mkdir(join(root, 'notes'), { recursive: true })
    await mkdir(join(root, 'node_modules', 'some-package'), { recursive: true })
    await mkdir(join(root, '.tmplan'), { recursive: true })

    await writeFile(join(root, 'README.md'), '# root', 'utf-8')
    await writeFile(join(root, 'docs', 'guide.md'), '# guide', 'utf-8')
    await writeFile(join(root, 'docs', 'nested', 'deep.md'), '# deep', 'utf-8')
    await writeFile(join(root, 'notes', 'todo.md'), '# todo', 'utf-8')
    await writeFile(join(root, 'notes', 'plain.txt'), 'ignore me', 'utf-8')
    await writeFile(join(root, 'node_modules', 'some-package', 'README.md'), '# ignored', 'utf-8')
    await writeFile(join(root, '.tmplan', 'internal.md'), '# ignored', 'utf-8')

    const docs = await collectMarkdownDocs(root, ['.', 'docs'])

    assert.deepEqual(
      docs.map((doc) => doc.path),
      ['README.md', 'docs/guide.md', 'notes/todo.md', 'docs/nested/deep.md']
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
