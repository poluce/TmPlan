export type ModelType = 'openai' | 'claude' | 'custom'

export function normalizeModelList(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  const raw =
    (Array.isArray(obj.data) ? obj.data : null) ||
    (Array.isArray(obj.models) ? obj.models : null) ||
    (Array.isArray(payload) ? payload : null)
  if (!raw) return []
  const ids = raw
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        if (typeof rec.id === 'string') return rec.id.trim()
        if (typeof rec.name === 'string') return rec.name.trim()
      }
      return ''
    })
    .filter(Boolean)
  return Array.from(new Set(ids))
}

export async function discoverModels(
  baseUrl: string,
  apiKey: string,
  modelType: ModelType
): Promise<string[]> {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const attempts: Array<{
    url: string
    headers: Record<string, string>
  }> = [
    {
      url: `${normalizedBase}/v1/models`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
    {
      url: `${normalizedBase}/models`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
    {
      url: `${normalizedBase}/v1/models`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    },
  ]

  if (modelType === 'claude') {
    attempts.unshift(attempts.pop()!)
  }

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: 'GET',
        headers: attempt.headers,
      })
      if (!res.ok) continue
      const data = await res.json().catch(() => null)
      const models = normalizeModelList(data)
      if (models.length > 0) return models
    } catch {
      // noop
    }
  }
  return []
}
