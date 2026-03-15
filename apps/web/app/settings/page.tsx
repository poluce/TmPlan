'use client'

import { useState } from 'react'
import { useSettingsStore, type ModelType } from '@/stores/settings-store'
import { ModelConfigForm } from '@/components/settings/model-config-form'
import { cn } from '@/lib/utils'
import { Trash2, Plus, ChevronRight, Cpu, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TYPE_LABELS: Record<ModelType, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  custom: '自定义',
}

type SettingsSection = 'models' | 'docs'

const MENU_ITEMS: { key: SettingsSection; label: string; icon: typeof Cpu }[] = [
  { key: 'models', label: '模型配置', icon: Cpu },
  { key: 'docs', label: '文档读取', icon: FileText },
]

export default function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('models')

  return (
    <div className="flex h-full">
      {/* Left: settings nav */}
      <nav className="w-48 shrink-0 border-r p-3 space-y-1">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">设置</p>
        {MENU_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              section === item.key
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right: content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'models' && <ModelsSection />}
        {section === 'docs' && <DocsSection />}
      </div>
    </div>
  )
}

function ModelsSection() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { profiles, activeProfileId, setActiveProfileId, deleteProfile } = useSettingsStore()

  function handleNew() {
    setEditingId(null)
    setShowForm(true)
  }

  function handleEdit(id: string) {
    setEditingId(id)
    setShowForm(true)
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">模型配置</h2>
          <p className="text-sm text-muted-foreground">管理 AI 服务的连接配置</p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="size-3.5" />
          新建配置
        </Button>
      </div>

      {profiles.length > 0 ? (
        <div className="rounded-md border divide-y">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={cn(
                'group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors',
                editingId === profile.id && showForm && 'bg-accent'
              )}
              onClick={() => handleEdit(profile.id)}
            >
              <div
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  profile.id === activeProfileId ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
                title={profile.id === activeProfileId ? '当前活跃' : '点击设为活跃'}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveProfileId(profile.id)
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{profile.label}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {TYPE_LABELS[profile.modelType]}
                  </span>
                  {profile.id === activeProfileId && (
                    <span className="text-xs text-primary font-medium">活跃</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {profile.modelName} · {profile.baseUrl}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`确定要删除配置「${profile.label}」吗？此操作不可撤销。`)) {
                      deleteProfile(profile.id)
                      if (editingId === profile.id) {
                        setShowForm(false)
                        setEditingId(null)
                      }
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">暂无配置，点击上方按钮新建</p>
        </div>
      )}

      {showForm && (
        <div className="pt-2">
          <ModelConfigForm
            editingId={editingId}
            onSaved={(id) => setEditingId(id)}
          />
        </div>
      )}
    </div>
  )
}

/* ---- Docs Section ---- */

function DocsSection() {
  const docPaths = useSettingsStore((s) => s.docPaths)
  const addDocPath = useSettingsStore((s) => s.addDocPath)
  const removeDocPath = useSettingsStore((s) => s.removeDocPath)
  const toggleDocPath = useSettingsStore((s) => s.toggleDocPath)
  const [newPath, setNewPath] = useState('')

  const handleAdd = () => {
    const trimmed = newPath.trim()
    if (!trimmed) return
    addDocPath(trimmed)
    setNewPath('')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">文档读取路径</h2>
        <p className="text-sm text-muted-foreground mt-1">
          配置项目中需要递归读取的文档路径（相对于项目根目录）。`.` 表示整个项目目录，会自动识别所有 `.md` 文件
        </p>
      </div>

      {/* Add new path */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="输入相对路径，如 .、docs 或 wiki"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newPath.trim()}>
          <Plus className="size-4 mr-1" />
          添加
        </Button>
      </div>

      {/* Path list */}
      <div className="space-y-2">
        {docPaths.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无配置的文档路径</p>
        ) : (
          docPaths.map((d) => (
            <div
              key={d.path}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <input
                type="checkbox"
                checked={d.enabled}
                onChange={() => toggleDocPath(d.path)}
                className="size-4 rounded"
              />
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <span className={cn('text-sm flex-1', !d.enabled && 'text-muted-foreground line-through')}>
                {d.path}
              </span>
              <button
                onClick={() => removeDocPath(d.path)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
