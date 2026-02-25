import { NextRequest, NextResponse } from 'next/server'
import { initTmplan } from '@/lib/tmplan/writer'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    await initTmplan(basePath)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
