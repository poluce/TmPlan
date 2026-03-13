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
      setConvertProgress(null)
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

    setConvertProgress({
      docStatus: initialStatus,
      overall: 'reading',
      message: '准备读取文档...',
    })

    const controller = new AbortController()
    abortRef.current = controller

    let finalMessage = '转换完成'

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
            switch (event.step) {
              case 'reading': {
                const nextDocStatus = Object.entries(prev.docStatus).reduce<Record<string, 'pending' | 'reading' | 'done'>>((acc, [path, status]) => {
                  return {
                    ...acc,
                    [path]: status === 'reading' ? 'done' : status,
                  }
                }, {})
                finalMessage = `读取 ${event.doc}...`
                return {
                  ...prev,
                  docStatus: { ...nextDocStatus, [event.doc]: 'reading' },
                  overall: 'reading',
                  message: finalMessage,
                }
              }
              case 'analyzing': {
                const doneStatus = Object.keys(prev.docStatus).reduce<Record<string, 'pending' | 'reading' | 'done'>>((acc, path) => {
                  return { ...acc, [path]: 'done' }
                }, {})
                finalMessage = `AI 分析中... (${event.docsCount} 篇文档)`
                return {
                  ...prev,
                  docStatus: doneStatus,
                  overall: 'analyzing',
                  message: finalMessage,
                }
              }
              case 'writing_module':
                finalMessage = `写入模块: ${event.name}`
                return { ...prev, overall: 'writing', message: finalMessage }
              case 'writing_decision':
                finalMessage = `写入决策 #${event.id}`
                return { ...prev, overall: 'writing', message: finalMessage }
              case 'done':
                finalMessage = `转换完成：${event.modules} 个模块，${event.decisions} 个决策`
                return { ...prev, overall: 'done', message: finalMessage }
              case 'error':
                finalMessage = event.message
                return { ...prev, overall: 'error', message: finalMessage }
              default:
                return prev
            }
          })
        },
        controller.signal
      )

      const modules = await readAllModules(projectId)
      setModules(modules)
      toast.success(finalMessage)
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
