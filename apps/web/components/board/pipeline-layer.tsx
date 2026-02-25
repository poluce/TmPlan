'use client'

import { type ReactNode } from 'react'
import { DependencyArrow } from './dependency-arrow'

interface PipelineLayerProps {
  /** 每列的项目，外层数组=列，内层数组=该列中可并行的项目 */
  columns: ReactNode[][]
}

export function PipelineLayer({ columns }: PipelineLayerProps) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto pb-2">
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="flex items-start">
          {colIdx > 0 && <DependencyArrow />}
          <div className="flex flex-col gap-2">
            {column.map((item, rowIdx) => (
              <div key={rowIdx}>{item}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
