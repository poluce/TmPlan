export interface DocPathConfig {
  path: string
  enabled: boolean
}

export function createDefaultDocPaths(): DocPathConfig[] {
  return [{ path: '.', enabled: true }]
}

function isDocPathConfig(value: unknown): value is DocPathConfig {
  if (!value || typeof value !== 'object') return false
  const docPath = value as Record<string, unknown>
  return typeof docPath.path === 'string' && typeof docPath.enabled === 'boolean'
}

function isLegacyDocsOnlyConfig(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false
  if (!isDocPathConfig(value[0])) return false
  return value[0].path === 'docs' && value[0].enabled === true
}

export function migrateDocPaths(value: unknown, version: number): DocPathConfig[] {
  if (version <= 2) return createDefaultDocPaths()
  if (value == null) return createDefaultDocPaths()
  if (isLegacyDocsOnlyConfig(value)) return createDefaultDocPaths()
  if (!Array.isArray(value)) return createDefaultDocPaths()

  const next: DocPathConfig[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (!isDocPathConfig(item)) continue
    const path = item.path.trim()
    if (!path || seen.has(path)) continue
    next.push({ path, enabled: item.enabled })
    seen.add(path)
  }

  return next.length > 0 ? next : createDefaultDocPaths()
}
