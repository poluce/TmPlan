import { NextRequest, NextResponse } from 'next/server'
import { collectMarkdownDocs } from '@/lib/tmplan/doc-discovery'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const pathsParam = req.nextUrl.searchParams.get('paths')

    if (!pathsParam) {
      return NextResponse.json({ files: [] })
    }

    const dirs = pathsParam.split(',').map((p) => p.trim()).filter(Boolean)
    const files = await collectMarkdownDocs(basePath, dirs)

    return NextResponse.json({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
