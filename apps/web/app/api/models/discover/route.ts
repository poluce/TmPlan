import { NextRequest, NextResponse } from 'next/server'
import { discoverModels, type ModelType } from '@/lib/ai/discover-models'

interface DiscoverBody {
  apiKey: string
  baseUrl: string
  modelType: ModelType
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DiscoverBody
    const { apiKey, baseUrl, modelType } = body

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { models: [], error: '请填写 API Key 和 Base URL' },
        { status: 400 }
      )
    }

    const models = await discoverModels(baseUrl, apiKey, modelType || 'custom')
    return NextResponse.json({ models })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ models: [], error: `请求异常: ${message}` })
  }
}
