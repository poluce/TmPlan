import { lstat, readFile, readdir } from 'fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'path'

import type { DocFile } from './data-access'

const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.tmplan',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'target',
])

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

function compareDocPaths(a: string, b: string): number {
  const depthA = a.split('/').length
  const depthB = b.split('/').length
  if (depthA !== depthB) return depthA - depthB
  return a.localeCompare(b, 'zh-Hans-CN')
}

function isWithinBase(basePath: string, targetPath: string): boolean {
  const rel = relative(basePath, targetPath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function appendMarkdownFile(
  basePath: string,
  filePath: string,
  files: DocFile[],
  seen: Set<string>
) {
  if (extname(filePath).toLowerCase() !== '.md') return

  const relativePath = toPosixPath(relative(basePath, filePath))
  if (seen.has(relativePath)) return

  const content = await readFile(filePath, 'utf-8')
  files.push({
    path: relativePath,
    name: filePath.split(/[\\/]/).pop() || relativePath,
    content,
  })
  seen.add(relativePath)
}

async function walkMarkdownFiles(
  basePath: string,
  currentPath: string,
  files: DocFile[],
  seen: Set<string>
): Promise<void> {
  const stat = await lstat(currentPath).catch(() => null)
  if (!stat) return

  if (stat.isFile()) {
    await appendMarkdownFile(basePath, currentPath, files, seen)
    return
  }

  if (!stat.isDirectory()) return

  const entries = await readdir(currentPath, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue
    if (entry.isSymbolicLink()) continue

    const nextPath = join(currentPath, entry.name)
    if (entry.isDirectory()) {
      await walkMarkdownFiles(basePath, nextPath, files, seen)
      continue
    }

    if (entry.isFile()) {
      await appendMarkdownFile(basePath, nextPath, files, seen)
    }
  }
}

export async function collectMarkdownDocs(
  basePath: string,
  relativePaths: string[]
): Promise<DocFile[]> {
  const resolvedBase = resolve(basePath)
  const files: DocFile[] = []
  const seen = new Set<string>()

  for (const rawPath of relativePaths) {
    const requestedPath = rawPath.trim() || '.'
    const targetPath = resolve(resolvedBase, requestedPath)
    if (!isWithinBase(resolvedBase, targetPath)) continue
    await walkMarkdownFiles(resolvedBase, targetPath, files, seen)
  }

  files.sort((a, b) => compareDocPaths(a.path, b.path))
  return files
}
