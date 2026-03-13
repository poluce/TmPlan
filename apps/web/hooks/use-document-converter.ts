'use client'

import { useMemo, useRef, useState } from 'react'
import { useBoardStore } from '@/stores/board-store'
import { useActiveProfile } from '@/stores/settings-store'
import { convertDocsStream, readAllModules } from '@/lib/tmplan/data-access'
import type { DocFile, ConvertProgress, ConvertStreamEvent } from '@/lib/tmplan/data-access'
import { toast } from 'sonner'

interface UseDocumentConverterOptions {
  projectId: string
  projectDocs: DocFile[]
}

function updateProgressFromEvent(
  prev: ConvertProgress,
  event: ConvertStreamEvent
): ConvertProgress {
  switch (event.step) {
    case 'reading': {
      const nextDocStatus = Object.entries(prev.docStatus).reduce<Record<string, 'pending' | 'reading' | 'done'>>((acc, [path, status]) => {
        return {
          ...acc,
          [path]: status === 'reading' ? 'done' : status,
        }
      }, {})
      return {
        ...prev,
        docStatus: { ...nextDocStatus, [event.doc]: 'reading' },
        overall: 'reading',
        message: `读取 ${event.doc}...`,
      }
    }
    case 'analyzing': {
      const doneStatus = Object.keys(prev.docStatus).reduce<Record<string, 'pending' | 'reading' | 'done'>>((acc, path) => {
        return { ...acc, [path]: 'done' }
      }, {})
      return {
        ...prev,
        docStatus: doneStatus,
        overall: 'analyzing',
        message: `AI 分析中... (${event.docsCount} 篇文档)`,
      }
    }
    case 'writing_module':
      return { ...prev, overall: 'writing', message: `写入模块: ${event.name}` }
    case 'writing_decision':
      return { ...prev, overall: 'writing', message: `写入决策 #${event.id}` }
    case 'done':
      return { ...prev, overall: 'done', message: `转换完成：${event.modules} 个模块，${event.decisions} 个决策` }
    case 'error':
      return { ...prev, overall: 'error', message: event.message }
    default:
      return prev
  }
}

export function useDocumentConverter({ projectId, projectDocs }: UseDocumentConverterOptions) {
  const [convertProgress, setConvertProgress] = useState<ConvertProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeProfile = useActiveProfile()
  const setModules = useBoardStore((s) => s.setModules)

  const isConverting = useMemo(() => {
    if (!convertProgress) return false
    return !['done', 'error', 'idle'].includes(convertProgress.overall)
  }, [convertProgress])

  async function handleConvert() {
    if (isConverting) {
      abortRef.current?.abort()
      setConvertProgress((prev) => prev ? { ...prev, overall: 'idle', message: '转换已取消' } : null)
      toast.info('转换已取消')
      return
    }

    if (projectDocs.length === 0) {
      toast.error('暂无文档可转换')
      return
    }

    if (!activeProfile?.apiKey) {
      toast.error('请先在设置中配置 API Key')
      return
    }

    const initialStatus = projectDocs.reduce<Record<string, 'pending' | 'reading' | 'done'>>((acc, doc) => {
      return { ...acc, [doc.path]: 'pending' }
    }, {})

    const initialProgress: ConvertProgress = {
      docStatus: initialStatus,
      overall: 'reading',
      message: '准备读取文档...',
    }
    setConvertProgress(initialProgress)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await convertDocsStream(
        projectId,
        projectDocs,
        {
          apiKey: activeProfile.apiKey,
          baseUrl: activeProfile.baseUrl,
          modelName: activeProfile.modelName,
          modelType: activeProfile.modelType,
        },
        (event: ConvertStreamEvent) => {
          setConvertProgress((prev) => {
            if (!prev) return prev
            return updateProgressFromEvent(prev, event)
          })
        },
        controller.signal
      )

      const modules = await readAllModules(projectId)
      setModules(modules)
      setConvertProgress((prev) => {
        if (!prev) return prev
        toast.success(prev.message)
        return prev
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      const message = error instanceof Error ? error.message : '转换失败'
      toast.error(message)
      setConvertProgress((prev) => prev ? { ...prev, overall: 'error', message } : null)
    } finally {
      abortRef.current = null
    }
  }

  return {
    convertProgress,
    isConverting,
    handleConvert,
  }
}
