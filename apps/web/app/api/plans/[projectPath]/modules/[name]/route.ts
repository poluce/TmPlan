import { NextRequest, NextResponse } from 'next/server'
import { readModule } from '@/lib/tmplan/reader'
import { writeModule } from '@/lib/tmplan/writer'
import type { ModulePlan } from '@/types/tmplan'

type Params = { projectPath: string; name: string }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectPath, name } = await params
    const basePath = decodeURIComponent(projectPath)
    const mod = await readModule(basePath, name)
    return NextResponse.json(mod)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const body = (await req.json()) as ModulePlan
    await writeModule(basePath, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
