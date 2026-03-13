'use client'

import { Bot, Download, Loader2, Plus, RefreshCw, SearchCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectToolbarProps {
  showGuide: boolean
  onToggleGuide: () => void
  onConvert: () => void
  onManualCheck: () => void
  onAddModule: () => void
  onImport: () => void
  onExport: () => void
  importing: boolean
  isConverting: boolean
  canExport: boolean
}

export function ProjectToolbar({
  showGuide,
  onToggleGuide,
  onConvert,
  onManualCheck,
  onAddModule,
  onImport,
  onExport,
  importing,
  isConverting,
  canExport,
}: ProjectToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onToggleGuide} className="gap-1.5">
        <Bot className="size-3.5" />
        {showGuide ? '隐藏引导' : 'AI 引导'}
      </Button>
      <Button variant="outline" size="sm" onClick={onConvert} className="gap-1.5">
        {isConverting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        {isConverting ? '转换中...' : '转换'}
      </Button>
      <Button variant="outline" size="sm" onClick={onManualCheck} className="gap-1.5">
        <SearchCheck className="size-3.5" />
        手动检查
      </Button>
      <Button variant="outline" size="sm" onClick={onAddModule} className="gap-1.5">
        <Plus className="size-3.5" />
        新增模块
      </Button>
      <Button variant="outline" size="sm" onClick={onImport} disabled={importing} className="gap-1.5">
        {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {importing ? '解析中...' : '导入'}
      </Button>
      <Button variant="outline" size="sm" onClick={onExport} disabled={!canExport} className="gap-1.5">
        <Download className="size-3.5" />
        导出
      </Button>
    </div>
  )
}
