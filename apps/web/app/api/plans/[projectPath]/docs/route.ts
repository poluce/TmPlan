import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import { join, extname } from 'path'

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
    const files: { path: string; name: string; content: string }[] = []

    for (const dir of dirs) {
      const fullDir = join(basePath, dir)
      let entries: string[]
      try {
        entries = await readdir(fullDir)
      } catch {
        // Directory doesn't exist, skip
        continue
      }

      const mdFiles = entries.filter((f) => extname(f).toLowerCase() === '.md')

      for (const name of mdFiles) {
        try {
          const content = await readFile(join(fullDir, name), 'utf-8')
          files.push({ path: `${dir}/${name}`, name, content })
        } catch {
          // Skip unreadable files
        }
      }
    }

    return NextResponse.json({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
