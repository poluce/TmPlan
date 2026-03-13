import { NextRequest, NextResponse } from "next/server"
import { ppfService } from "@/lib/ppf/ppf-service"
import type { EventQuery } from "@/types/event-sourcing"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const url = req.nextUrl.searchParams

    const query: EventQuery = {
      from_date: url.get("from_date") ?? undefined,
      to_date: url.get("to_date") ?? undefined,
      type: (url.get("type") as EventQuery["type"]) ?? undefined,
      actor: url.get("actor") ?? undefined,
      source: (url.get("source") as EventQuery["source"]) ?? undefined,
      limit: url.has("limit") ? Number(url.get("limit")) : 50,
      offset: url.has("offset") ? Number(url.get("offset")) : 0,
    }

    const events = await ppfService.getEvents(basePath, query)
    return NextResponse.json({ events })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
