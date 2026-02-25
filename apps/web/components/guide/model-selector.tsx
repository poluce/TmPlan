'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { useActiveProfile } from '@/stores/settings-store'

interface ModelSelectorProps {
  onModelChange: (model: string) => void
  selectedModel: string
}

export function ModelSelector({ onModelChange, selectedModel }: ModelSelectorProps) {
  const activeProfile = useActiveProfile()
  const apiKey = activeProfile?.apiKey ?? ''
  const baseUrl = activeProfile?.baseUrl ?? ''
  const modelType = activeProfile?.modelType ?? ''

  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualInput, setManualInput] = useState(false)

  const fetchModels = useCallback(async () => {
    if (!apiKey || !baseUrl) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/models/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, baseUrl, modelType }),
      })
      const data = await res.json()
      const list: string[] = Array.isArray(data.models) ? data.models : []
      setModels(list)
      if (list.length > 0) {
        setManualInput(false)
        if (!selectedModel) {
          onModelChange(list[0])
        }
      } else {
        setManualInput(true)
      }
    } catch {
      setError('获取模型列表失败')
      setManualInput(true)
    } finally {
      setLoading(false)
    }
  }, [apiKey, baseUrl, modelType, selectedModel, onModelChange])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  if (!apiKey || !baseUrl) return null

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>加载模型...</span>
      </div>
    )
  }

  if (manualInput || models.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={selectedModel}
          onChange={(e) => {
            const val = e.target.value
            onModelChange(val)
          }}
          placeholder="输入模型名称"
          className="h-7 w-40 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {models.length > 0 && (
          <button
            type="button"
            onClick={() => setManualInput(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            列表
          </button>
        )}
        {error && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            {error}
            <button type="button" onClick={fetchModels} className="underline">重试</button>
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <div className="relative">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="h-7 appearance-none rounded-md border bg-background pl-2 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      </div>
      <button
        type="button"
        onClick={() => setManualInput(true)}
        className="text-xs text-muted-foreground hover:underline"
      >
        自定义
      </button>
    </div>
  )
}
