"use client"

import { useEffect, useState, useCallback } from "react"

interface MenuState {
  visible: boolean
  x: number
  y: number
  info: string
}

function getReactFiber(el: Element): any {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"))
  return key ? (el as any)[key] : null
}

function getComponentSource(fiber: any): string | null {
  let current = fiber
  while (current) {
    if (current._debugSource?.fileName) {
      return current._debugSource.fileName
    }
    current = current.return
  }
  return null
}

function getComponentName(fiber: any): string | null {
  let current = fiber
  while (current) {
    if (typeof current.type === "function" && current.type.name) {
      return current.type.name
    }
    current = current.return
  }
  return null
}

function normalizeFilePath(raw: string): string {
  const normalized = raw.replace(/\\/g, "/")
  const marker = "apps/web/"
  const idx = normalized.indexOf(marker)
  return idx !== -1 ? normalized.slice(idx + marker.length) : normalized
}

function getCssSelector(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.documentElement) {
    const currentElement: Element = current

    if (currentElement.id) {
      parts.unshift(`#${currentElement.id}`)
      break
    }

    const tag = currentElement.tagName.toLowerCase()
    const parent: Element | null = currentElement.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === currentElement.tagName
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentElement) + 1
        parts.unshift(`${tag}:nth-of-type(${index})`)
      } else {
        parts.unshift(tag)
      }
    } else {
      parts.unshift(tag)
    }

    current = parent
  }

  return parts.join(" > ")
}

function getTextContent(el: Element): string {
  const text = (el.textContent || "").trim()
  if (!text) return ""
  return text.length > 50 ? text.slice(0, 50) + "…" : text
}

function buildInfo(el: Element): string {
  const fiber = getReactFiber(el)
  const lines: string[] = []

  if (fiber) {
    const source = getComponentSource(fiber)
    const name = getComponentName(fiber)
    if (source) {
      const path = normalizeFilePath(source)
      lines.push(`组件: ${path}`)
    } else if (name) {
      lines.push(`组件: ${name}`)
    }
  }

  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute("role")
  const elementDesc = role ? `${role} <${tag}>` : `<${tag}>`
  lines.push(`元素: ${elementDesc}`)

  const text = getTextContent(el)
  if (text) {
    lines.push(`文本: "${text}"`)
  }

  lines.push(`CSS选择器: ${getCssSelector(el)}`)

  return lines.join("\n")
}

export function DevContextMenu() {
  const [menu, setMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    info: "",
  })
  const [copied, setCopied] = useState(false)

  const close = useCallback(() => {
    setMenu((prev) => ({ ...prev, visible: false }))
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(menu.info)
      setCopied(true)
      setTimeout(close, 600)
    } catch {
      // fallback: select from textarea
    }
  }, [menu.info, close])

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      // 仅在按住 Alt 时触发，避免覆盖浏览器默认右键菜单
      if (!e.altKey) return

      e.preventDefault()
      const target = e.target as Element
      const info = buildInfo(target)

      setMenu({
        visible: true,
        x: Math.min(e.clientX, window.innerWidth - 280),
        y: Math.min(e.clientY, window.innerHeight - 80),
        info,
      })
      setCopied(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-dev-context-menu]")) {
        close()
      }
    }

    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("click", onClick)
    window.addEventListener("scroll", close, true)

    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("click", onClick)
      window.removeEventListener("scroll", close, true)
    }
  }, [close])

  if (!menu.visible) return null

  return (
    <div
      data-dev-context-menu
      className="fixed z-[9999] min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        onClick={handleCopy}
        className="flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
      >
        {copied ? "✓ 已复制" : "复制元素信息"}
      </button>
      <div className="mx-2 mt-1 mb-1 max-h-[200px] overflow-auto rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap font-mono">
        {menu.info}
      </div>
    </div>
  )
}
