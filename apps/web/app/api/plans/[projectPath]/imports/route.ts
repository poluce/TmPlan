import { NextRequest, NextResponse } from 'next/server'
import { readFieldSourceRegistry, readImportManifest } from '@/lib/tmplan/reader'
import { appendImportMetadata } from '@/lib/tmplan/writer'
import type { FieldSourceRecord, ImportRecord } from '@/types/tmplan-imports'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)

    const [manifest, fieldSources] = await Promise.all([
      readImportManifest(basePath),
      readFieldSourceRegistry(basePath),
    ])

    return NextResponse.json({ manifest, fieldSources })
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
    const body = await req.json() as {
      record: ImportRecord
      fieldRecords: FieldSourceRecord[]
    }

    if (!body.record) {
      return NextResponse.json({ error: '缺少导入记录' }, { status: 400 })
    }

    await appendImportMetadata(basePath, body.record, body.fieldRecords || [])

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
