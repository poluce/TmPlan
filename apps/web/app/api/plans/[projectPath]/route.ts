import { NextRequest, NextResponse } from 'next/server'
import { readProject } from '@/lib/tmplan/reader'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const project = await readProject(basePath)
    return NextResponse.json(project)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
