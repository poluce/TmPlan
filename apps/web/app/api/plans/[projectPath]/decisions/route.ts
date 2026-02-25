import { NextRequest, NextResponse } from 'next/server'
import { readAllDecisions } from '@/lib/tmplan/reader'
import { writeDecision } from '@/lib/tmplan/writer'
import type { Decision } from '@/types/tmplan'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectPath: string }> }
) {
  try {
    const { projectPath } = await params
    const basePath = decodeURIComponent(projectPath)
    const decisions = await readAllDecisions(basePath)
    return NextResponse.json(decisions)
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
    const body = (await req.json()) as Decision

    if (!body.decision_id || !body.question) {
      return NextResponse.json(
        { error: 'decision_id and question are required' },
        { status: 400 }
      )
    }

    await writeDecision(basePath, body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
