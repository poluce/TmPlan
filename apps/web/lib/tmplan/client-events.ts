'use client'

const PROJECT_UPDATED_EVENT = 'tmplan:project-updated'

export function dispatchProjectUpdated(projectPath: string) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<{ projectPath: string }>(PROJECT_UPDATED_EVENT, {
      detail: { projectPath },
    })
  )
}

export function subscribeProjectUpdated(
  listener: (projectPath: string) => void
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ projectPath?: string }>).detail
    if (detail?.projectPath) {
      listener(detail.projectPath)
    }
  }

  window.addEventListener(PROJECT_UPDATED_EVENT, handleEvent)
  return () => window.removeEventListener(PROJECT_UPDATED_EVENT, handleEvent)
}
