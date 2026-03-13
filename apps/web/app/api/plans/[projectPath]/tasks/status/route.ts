import { NextRequest, NextResponse } from "next/server"
import { ppfService } from "@/lib/ppf/ppf-service"
import type { TaskStatus } from "@/types/tmplan"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const body = (await req.json()) as {
      moduleSlug: string
      taskId: string
      status: TaskStatus
    }

    if (!body.moduleSlug || !body.taskId || !body.status) {
      return NextResponse.json(
        { error: "moduleSlug, taskId, status are required" },
        { status: 400 }
      )
    }

    const validStatuses: TaskStatus[] = [
      "pending",
      "in_progress",
      "completed",
      "blocked",
    ]
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const result = await ppfService.changeTaskStatus(
      basePath,
      body.moduleSlug,
      body.taskId,
      body.status
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
