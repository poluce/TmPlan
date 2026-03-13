import { NextRequest, NextResponse } from "next/server"
import { ppfService } from "@/lib/ppf/ppf-service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const markdown = await ppfService.exportMarkdown(basePath)
    return NextResponse.json({ markdown })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const _basePath = decodeURIComponent(projectPath)
    const body = (await req.json()) as { markdown: string }

    if (!body.markdown || typeof body.markdown !== "string") {
      return NextResponse.json(
        { error: "markdown field is required" },
        { status: 400 }
      )
    }

    const result = ppfService.importMarkdown(body.markdown)
    return NextResponse.json({
      project: result.project,
      modules: result.modules,
      anchorsFound: result.anchorsFound,
      newContentCount: result.newContentCount,
      unmatchedContent: result.unmatchedContent,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
