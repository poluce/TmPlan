'use client'

import { useSettingsStore, type ModelProfile, type ModelType } from '@/stores/settings-store'
import { cn } from '@/lib/utils'
import { Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProfileSidebarProps {
  editingId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

const TYPE_LABELS: Record<ModelType, string> = {
  claude: 'Claude',
  openai: 'OpenAI',
  custom: '自定义',
}

const TYPE_ORDER: ModelType[] = ['claude', 'openai', 'custom']

export function ProfileSidebar({ editingId, onSelect, onNew }: ProfileSidebarProps) {
  const { profiles, activeProfileId, setActiveProfileId, deleteProfile } =
    useSettingsStore()

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: profiles.filter((p) => p.modelType === type),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r">
      <div className="p-3 text-sm font-semibold">配置列表</div>

      <div className="flex-1 overflow-y-auto">
        {grouped.map((group) => (
          <div key={group.type} className="mb-2">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((profile) => (
              <ProfileItem
                key={profile.id}
                profile={profile}
                isActive={profile.id === activeProfileId}
                isEditing={profile.id === editingId}
                onSelect={() => onSelect(profile.id)}
                onSetActive={() => setActiveProfileId(profile.id)}
                onDelete={() => deleteProfile(profile.id)}
              />
            ))}
          </div>
        ))}

        {profiles.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            暂无配置，点击下方按钮新建
          </p>
        )}
      </div>

      <div className="border-t p-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onNew}>
          <Plus className="size-3.5" />
          新建配置
        </Button>
      </div>
    </div>
  )
}

function ProfileItem({
  profile,
  isActive,
  isEditing,
  onSelect,
  onSetActive,
  onDelete,
}: {
  profile: ModelProfile
  isActive: boolean
  isEditing: boolean
  onSelect: () => void
  onSetActive: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/50',
        isEditing && 'bg-accent',
        isActive && 'border-l-2 border-l-primary bg-primary/5'
      )}
      onClick={() => { onSelect(); onSetActive(); }}
    >
      {isActive ? (
        <div className="size-3 shrink-0 rounded-full border-2 border-primary bg-primary" title="当前活跃" />
      ) : (
        <div
          className="size-3 shrink-0 rounded-full border-2 border-muted-foreground/30 hover:border-primary/50"
          title="点击设为活跃"
          onClick={(e) => { e.stopPropagation(); onSetActive(); }}
        />
      )}
      <div className="flex-1 truncate">
        <span className="truncate">{profile.label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          className="rounded p-0.5 text-xs text-muted-foreground hover:text-destructive"
          title="删除"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`确定要删除配置「${profile.label}」吗？此操作不可撤销。`)) {
              onDelete()
            }
          }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}
