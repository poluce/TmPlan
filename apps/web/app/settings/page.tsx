'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProfileSidebar } from '@/components/settings/profile-sidebar'
import { ModelConfigForm } from '@/components/settings/model-config-form'

export default function SettingsPage() {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Link href="/" className="rounded p-1 hover:bg-accent">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-semibold">设置</h1>
      </header>
      <div className="flex flex-1">
        <ProfileSidebar
          editingId={editingId}
          onSelect={(id) => setEditingId(id)}
          onNew={() => setEditingId(null)}
        />
        <div className="flex flex-1 items-start justify-center p-8">
          <div className="w-full max-w-lg">
            <ModelConfigForm
              editingId={editingId}
              onSaved={(id) => setEditingId(id)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
