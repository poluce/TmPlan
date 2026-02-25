'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FreeInputProps {
  questionText?: string
  placeholder?: string
  onSubmit: (text: string) => void
  disabled?: boolean
}

export function FreeInput({
  questionText,
  placeholder = '输入你的想法...',
  onSubmit,
  disabled = false,
}: FreeInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <div className="space-y-3">
      {questionText && <p className="text-sm font-medium">{questionText}</p>}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="发送"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
