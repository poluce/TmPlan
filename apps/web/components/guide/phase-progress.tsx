'use client'

import { cn } from '@/lib/utils'
import { GUIDE_PHASES } from '@/stores/guide-store'
import type { GuidePhaseSlug } from '@/lib/ai/prompts'
import { Check } from 'lucide-react'

interface PhaseProgressProps {
  currentPhase: GuidePhaseSlug
  completedPhases: GuidePhaseSlug[]
}

export function PhaseProgress({ currentPhase, completedPhases }: PhaseProgressProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {GUIDE_PHASES.map((phase, i) => {
        const isCompleted = completedPhases.includes(phase.slug)
        const isCurrent = phase.slug === currentPhase
        const isPast = isCompleted && !isCurrent

        return (
          <div key={phase.slug} className="flex items-center gap-1 flex-1">
            {/* Dot */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && !isCompleted && 'border-primary bg-background text-primary',
                  !isCurrent && !isCompleted && 'border-muted-foreground/30 bg-background text-muted-foreground/50'
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] leading-none whitespace-nowrap',
                  (isCurrent || isCompleted) ? 'text-foreground font-medium' : 'text-muted-foreground/50'
                )}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector line */}
            {i < GUIDE_PHASES.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  isPast ? 'bg-primary' : 'bg-muted-foreground/20'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
