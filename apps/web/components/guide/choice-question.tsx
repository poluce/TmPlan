'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { QuestionOption } from '@/stores/guide-store'

interface ChoiceQuestionProps {
  questionId: string
  text: string
  type: 'single' | 'multi'
  options: QuestionOption[]
  recommendation?: string
  onConfirm: (selectedIds: string[]) => void
  disabled?: boolean
}

const CUSTOM_OPTION: QuestionOption = {
  id: 'custom',
  label: '以上都不是',
  description: '我想自定义输入',
}

export function ChoiceQuestion({
  questionId,
  text,
  type,
  options: rawOptions,
  recommendation,
  onConfirm,
  disabled = false,
}: ChoiceQuestionProps) {
  const options = Array.isArray(rawOptions) ? rawOptions : []
  const [selected, setSelected] = useState<string[]>([])
  const [customText, setCustomText] = useState('')

  // Append the "custom" option if not already present
  const allOptions = options.some((o) => o.id === 'custom')
    ? options
    : [...options, CUSTOM_OPTION]

  function toggle(id: string) {
    if (disabled) return
    if (type === 'single') {
      setSelected([id])
      // Clear custom text when switching away
      if (id !== 'custom') setCustomText('')
    } else {
      setSelected((prev) => {
        const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        if (!next.includes('custom')) setCustomText('')
        return next
      })
    }
  }

  function handleConfirm() {
    const result = selected.map((id) => {
      if (id === 'custom' && customText.trim()) {
        return `custom:${customText.trim()}`
      }
      return id
    })
    onConfirm(result)
  }

  const isCustomSelected = selected.includes('custom')
  const canConfirm = selected.length > 0 && (!isCustomSelected || customText.trim().length > 0)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{text}</p>
      <div className="grid gap-2">
        {allOptions.map((opt) => {
          const isSelected = selected.includes(opt.id)
          const isRecommended = recommendation === opt.id
          const isCustom = opt.id === 'custom'
          return (
            <div key={opt.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(opt.id)}
                className={cn(
                  'relative flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30',
                  isCustom && !isSelected && 'border-dashed',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                {/* Radio / Checkbox indicator */}
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    type === 'multi' && 'rounded-md',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  )}
                >
                  {isSelected && <Check className="size-3" />}
                </span>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{opt.label}</span>
                    {isRecommended && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        推荐
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>

              {/* Custom text input */}
              {isCustom && isSelected && (
                <div className="mt-2 ml-8">
                  <Input
                    placeholder="请输入你的想法..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    disabled={disabled}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm) handleConfirm()
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button
        size="sm"
        onClick={handleConfirm}
        disabled={disabled || !canConfirm}
        className="w-full"
      >
        确认
      </Button>
    </div>
  )
}
