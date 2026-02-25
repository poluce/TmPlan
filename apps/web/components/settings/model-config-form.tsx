'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useSettingsStore, DEFAULT_BASE_URLS, DEFAULT_MODELS, type ModelType } from '@/stores/settings-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ModelConfigFormProps {
  editingId: string | null
  onSaved?: (id: string) => void
}

export function ModelConfigForm({ editingId, onSaved }: ModelConfigFormProps) {
  const { profiles, addProfile, updateProfile } = useSettingsStore()

  const [label, setLabel] = useState('')
  const [modelType, setModelType] = useState<ModelType>('openai')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URLS.openai)
  const [modelName, setModelName] = useState(DEFAULT_MODELS.openai)

  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saved, setSaved] = useState(false)

  // Load profile into form when editingId changes
  useEffect(() => {
    if (editingId) {
      const p = profiles.find((x) => x.id === editingId)
      if (p) {
        setLabel(p.label)
        setModelType(p.modelType)
        setApiKey(p.apiKey)
        setBaseUrl(p.baseUrl)
        setModelName(p.modelName)
        setTestResult(null)
        setSaved(false)
        return
      }
    }
    // Reset for new profile
    setLabel('')
    setModelType('openai')
    setApiKey('')
    setBaseUrl(DEFAULT_BASE_URLS.openai)
    setModelName(DEFAULT_MODELS.openai)
    setTestResult(null)
    setSaved(false)
  }, [editingId, profiles])

  function handleModelTypeChange(type: ModelType) {
    const currentDefaults = { baseUrl: DEFAULT_BASE_URLS[modelType], modelName: DEFAULT_MODELS[modelType] }
    const hasCustomValues = baseUrl !== currentDefaults.baseUrl || modelName !== currentDefaults.modelName
    if (hasCustomValues && !window.confirm('切换模型类型将重置 Base URL 和模型名称，确定继续吗？')) {
      return
    }
    setModelType(type)
    setBaseUrl(DEFAULT_BASE_URLS[type])
    setModelName(DEFAULT_MODELS[type])
    setTestResult(null)
    if (!label) {
      setLabel(type === 'claude' ? 'Claude' : type === 'openai' ? 'OpenAI' : '自定义')
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, baseUrl, modelType }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, message: '网络请求失败' })
    } finally {
      setTesting(false)
    }
  }

  function handleSave() {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'API Key 不能为空' })
      return
    }
    if (!baseUrl.trim()) {
      setTestResult({ success: false, message: 'Base URL 不能为空' })
      return
    }
    if (!modelName.trim()) {
      setTestResult({ success: false, message: '模型名称不能为空' })
      return
    }
    const profileLabel = label.trim() || (modelType === 'claude' ? 'Claude' : modelType === 'openai' ? 'OpenAI' : '自定义')
    if (editingId) {
      updateProfile(editingId, { label: profileLabel, modelType, apiKey, baseUrl, modelName })
      onSaved?.(editingId)
    } else {
      const id = addProfile({ label: profileLabel, modelType, apiKey, baseUrl, modelName })
      onSaved?.(id)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const canTest = !!apiKey && !!baseUrl

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{editingId ? '编辑配置' : '新建配置'}</CardTitle>
        <CardDescription>配置 AI 服务的连接信息</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 配置名称 */}
        <div className="space-y-2">
          <Label>配置名称</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如：我的 Claude 配置"
          />
        </div>

        {/* 模型类型 */}
        <div className="space-y-2">
          <Label>模型类型</Label>
          <Select
            value={modelType}
            onValueChange={(v) => handleModelTypeChange(v as ModelType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="custom">自定义 (OpenAI 兼容)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* API Key */}
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入你的 API Key"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
          {modelType === 'custom' && (
            <p className="text-xs text-muted-foreground">
              填写 OpenAI 兼容 API 的地址，如 https://your-api.com/v1
            </p>
          )}
        </div>

        {/* Model Name */}
        <div className="space-y-2">
          <Label>模型名称</Label>
          <Input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="例如：gpt-4o"
          />
        </div>

        <Separator />

        {/* 测试连接 */}
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !canTest}
            className="w-full"
          >
            {testing && <Loader2 className="size-4 animate-spin" />}
            {testing ? '测试中...' : '测试连接'}
          </Button>
          {testResult && (
            <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.message}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} className={cn("w-full", saved && "bg-green-600 hover:bg-green-600")}>
          {saved ? '✓ 已保存' : '保存'}
        </Button>
      </CardFooter>
    </Card>
  )
}
