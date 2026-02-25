import { NextRequest, NextResponse } from 'next/server'
import { readStatus } from '@/lib/tmplan/reader'
import { updateStatus } from '@/lib/tmplan/writer'
import type { ProjectStatus } from '@/types/tmplan'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const status = await readStatus(basePath)
    return NextResponse.json(status)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const body = (await req.json()) as ProjectStatus
    await updateStatus(basePath, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
