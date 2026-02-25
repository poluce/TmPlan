import { NextRequest, NextResponse } from 'next/server'
import { readAllModules } from '@/lib/tmplan/reader'
import { writeModule } from '@/lib/tmplan/writer'
import type { ModulePlan } from '@/types/tmplan'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const modules = await readAllModules(basePath)
    return NextResponse.json(modules)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const body = (await req.json()) as ModulePlan

    if (!body.slug) {
      return NextResponse.json(
        { error: 'slug is required' },
        { status: 400 }
      )
    }

    await writeModule(basePath, body)
    return NextResponse.json({ success: true, name: body.slug }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
