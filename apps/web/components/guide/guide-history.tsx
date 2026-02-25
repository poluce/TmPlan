'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuideMessage } from '@/stores/guide-store'

interface GuideHistoryProps {
  messages: GuideMessage[]
}

function QAPair({ assistant, user }: { assistant: GuideMessage; user?: GuideMessage }) {
  const [open, setOpen] = useState(false)

  const question = assistant.question
  const answer = user?.answer

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <MessageSquare className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate font-medium">
          {question?.text || assistant.content}
        </span>
        {answer && (
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            已回答
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2">
          {/* AI message */}
          {assistant.content && (
            <p className="text-xs text-muted-foreground">{assistant.content}</p>
          )}

          {/* Options shown */}
          {question?.options && question.options.length > 0 && (
            <div className="space-y-1">
              {question.options.map((opt) => {
                const isChosen = answer?.selectedOptions?.includes(opt.id)
                return (
                  <div
                    key={opt.id}
                    className={cn(
                      'rounded px-2 py-1 text-xs',
                      isChosen
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {opt.label}
                    {isChosen && ' ✓'}
                  </div>
                )
              })}
            </div>
          )}

          {/* User text answer */}
          {answer?.textInput && (
            <div className="flex items-start gap-2 rounded bg-muted/50 p-2">
              <User className="mt-0.5 size-3 text-muted-foreground" />
              <p className="text-xs">{answer.textInput}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function GuideHistory({ messages }: GuideHistoryProps) {
  // Pair up assistant questions with user answers
  const pairs: Array<{ assistant: GuideMessage; user?: GuideMessage }> = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && msg.question) {
      const nextMsg = messages[i + 1]
      if (nextMsg?.role === 'user') {
        pairs.push({ assistant: msg, user: nextMsg })
      } else {
        pairs.push({ assistant: msg })
      }
    }
  }

  if (pairs.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">引导历史</p>
      {pairs.map((pair, i) => (
        <QAPair key={i} assistant={pair.assistant} user={pair.user} />
      ))}
    </div>
  )
}
