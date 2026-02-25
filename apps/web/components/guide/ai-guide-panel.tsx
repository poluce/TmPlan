'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { useGuideStore, getNextPhase, type AiConfig } from '@/stores/guide-store'
import { useBoardStore } from '@/stores/board-store'
import { useActiveProfile } from '@/stores/settings-store'
import { GuideHistory } from './guide-history'
import { ChoiceQuestion } from './choice-question'
import { FreeInput } from './free-input'
import { PlanPreview } from './plan-preview'
import { ModelSelector } from './model-selector'
import { PhaseProgress } from './phase-progress'
import { PhaseResultPreview } from './phase-result-preview'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

interface AiGuidePanelProps {
  projectPath: string
}

export function AiGuidePanel({ projectPath }: AiGuidePanelProps) {
  const {
    messages,
    currentQuestion,
    isGenerating,
    planResult,
    error,
    currentPhase,
    phaseResults,
    pendingPhaseResult,
    startSession,
    answerQuestion,
    confirmPhase,
    reguidePhase,
    savePlan,
    reset,
    retryLast,
    clearForProject,
  } = useGuideStore()

  const { updateProjectMeta, addFeatureModules, addImplModules } = useBoardStore()

  const activeProfile = useActiveProfile()
  const [selectedModel, setSelectedModel] = useState(activeProfile?.modelName ?? '')
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    setSelectedModel(activeProfile?.modelName ?? '')
  }, [activeProfile?.modelName])

  useEffect(() => {
    clearForProject(projectPath)
  }, [projectPath, clearForProject])

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model)
  }, [])

  function getAiConfig(): AiConfig | undefined {
    if (!activeProfile) return undefined
    return {
      apiKey: activeProfile.apiKey,
      baseUrl: activeProfile.baseUrl,
      modelName: selectedModel || activeProfile.modelName,
      modelType: activeProfile.modelType,
    }
  }

  const hasStarted = messages.length > 0
  const hasApiKey = hydrated && !!activeProfile?.apiKey
  const completedPhases = phaseResults.map((r) => r.phase)

  async function handleStart(input: string) {
    await startSession(projectPath, input, getAiConfig())
  }

  async function handleAnswer(answer: Parameters<typeof answerQuestion>[0]) {
    await answerQuestion(answer, getAiConfig())
  }

  function handleConfirmPhase() {
    if (!pendingPhaseResult) return

    // Sync to board store before confirming
    if (pendingPhaseResult.phase === 'concept') {
      updateProjectMeta(pendingPhaseResult.project_name, pendingPhaseResult.description)
    } else if (pendingPhaseResult.phase === 'features') {
      addFeatureModules(pendingPhaseResult.modules)
    } else if (pendingPhaseResult.phase === 'ui-pages') {
      addFeatureModules(pendingPhaseResult.pages)
    } else if (pendingPhaseResult.phase === 'tech-impl') {
      const now = new Date().toISOString()
      addImplModules(
        pendingPhaseResult.modules.map((m) => ({
          module: m.module,
          slug: m.slug,
          layer: 'implementation' as const,
          status: 'pending' as const,
          depends_on: m.depends_on || [],
          decision_refs: [],
          overview: m.overview,
          priority: (m.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
          estimated_hours: null,
          created_at: now,
          updated_at: now,
          tasks: (m.tasks || []).map((t) => ({
            id: t.id,
            title: t.title,
            status: 'pending' as const,
            depends_on: t.depends_on || [],
            detail: t.detail,
            files_to_create: t.files_to_create || [],
            files_to_modify: t.files_to_modify || [],
            acceptance_criteria: t.acceptance_criteria || [],
          })),
        }))
      )
    }

    confirmPhase()

    // Auto-start next phase
    const nextPhase = getNextPhase(pendingPhaseResult.phase)
    if (nextPhase) {
      setTimeout(() => {
        handleStart('请基于已确认的信息继续引导')
      }, 300)
    }
  }

  async function handleSave() {
    setSaving(true)
    await savePlan(projectPath)
    setSaving(false)
  }

  function handleChoiceConfirm(selectedIds: string[]) {
    if (!currentQuestion) return
    handleAnswer({
      questionId: currentQuestion.id,
      type: 'choice',
      selectedOptions: selectedIds,
    })
  }

  function handleTextSubmit(text: string) {
    if (!hasStarted) {
      handleStart(text)
      return
    }
    if (currentQuestion) {
      handleAnswer({
        questionId: currentQuestion.id,
        type: 'text',
        textInput: text,
      })
    }
  }

  // ---- Render ----

  // Not started yet — show initial input
  if (!hasStarted && !pendingPhaseResult && phaseResults.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <h2 className="text-sm font-semibold">AI 引导式规划</h2>
          </div>
          {hydrated && <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />}
        </div>
        <Separator />
        <PhaseProgress currentPhase={currentPhase} completedPhases={completedPhases} />
        <Separator />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              描述你想做的项目，AI 会分阶段引导你制定详细计划
            </p>
          </div>
          <div className="w-full max-w-md">
            <FreeInput
              placeholder="例如：我想做一个博客系统..."
              onSubmit={handleStart}
              disabled={!hasApiKey}
            />
            {hydrated && !activeProfile?.apiKey && (
              <p className="mt-2 text-xs text-destructive">
                请先在<Link href="/settings" className="underline font-medium">设置</Link>中配置 API Key
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Between phases — need user to start next phase input
  const isBetweenPhases = !hasStarted && !pendingPhaseResult && phaseResults.length > 0 && currentPhase !== phaseResults[phaseResults.length - 1]?.phase

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          <h2 className="text-sm font-semibold">AI 引导式规划</h2>
          {hydrated && <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />}
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-3.5" />
          重新开始
        </Button>
      </div>
      <Separator />

      {/* Phase progress */}
      <PhaseProgress currentPhase={currentPhase} completedPhases={completedPhases} />
      <Separator />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Between phases prompt */}
        {isBetweenPhases && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              上一阶段已确认，请输入更多信息继续下一阶段的引导，或直接点击发送让 AI 继续。
            </p>
            <FreeInput
              placeholder="补充说明（可选，直接发送继续）..."
              onSubmit={handleTextSubmit}
              disabled={!hasApiKey}
            />
          </div>
        )}

        {/* History */}
        {messages.length > 0 && <GuideHistory messages={messages} />}

        {/* Error */}
        {error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => retryLast(getAiConfig())} disabled={isGenerating}>
                <RotateCcw className="size-3.5" />
                重试
              </Button>
              <span className="text-xs text-muted-foreground">可切换模型后重试</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {isGenerating && (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            AI 正在思考...
          </div>
        )}

        {/* Pending phase result */}
        {pendingPhaseResult && !isGenerating && (
          <PhaseResultPreview
            result={pendingPhaseResult}
            onConfirm={handleConfirmPhase}
            onReguide={reguidePhase}
          />
        )}

        {/* Current question */}
        {currentQuestion && !isGenerating && !pendingPhaseResult && (
          <>
            {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content && (
              <p className="text-sm text-muted-foreground">
                {messages[messages.length - 1].content}
              </p>
            )}

            {currentQuestion.type === 'text' ? (
              <FreeInput
                questionText={currentQuestion.text}
                onSubmit={handleTextSubmit}
                disabled={isGenerating}
              />
            ) : (
              <ChoiceQuestion
                questionId={currentQuestion.id}
                text={currentQuestion.text}
                type={currentQuestion.type}
                options={currentQuestion.options || []}
                recommendation={currentQuestion.recommendation}
                onConfirm={handleChoiceConfirm}
                disabled={isGenerating}
              />
            )}
          </>
        )}

        {/* Legacy plan result */}
        {planResult && !isGenerating && (
          <PlanPreview
            plan={planResult}
            onSave={handleSave}
            onReset={reset}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}
