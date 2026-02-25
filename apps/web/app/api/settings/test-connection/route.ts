import { NextRequest, NextResponse } from 'next/server'
import { discoverModels } from '@/lib/ai/discover-models'

interface TestConnectionBody {
  apiKey: string
  baseUrl: string
  modelType: 'openai' | 'claude' | 'custom'
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TestConnectionBody
    const { apiKey, baseUrl, modelType } = body

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { success: false, message: '请填写 API Key 和 Base URL' },
        { status: 400 }
      )
    }

    // Try to discover models to verify the connection works
    const models = await discoverModels(baseUrl, apiKey, modelType)

    if (models.length > 0) {
      return NextResponse.json({
        success: true,
        message: `连接成功，发现 ${models.length} 个可用模型`,
        models,
      })
    }

    // Fallback: try a simple request to verify connectivity
    const normalizedBase = baseUrl.replace(/\/$/, '')
    let testOk = false

    if (modelType === 'claude') {
      try {
        const res = await fetch(`${normalizedBase}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'test',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        })
        // Even a 400 (bad model) means the connection itself works
        testOk = res.status !== 401 && res.status !== 403
      } catch {
        // connection failed
      }
    } else {
      try {
        const res = await fetch(`${normalizedBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'test',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        })
        testOk = res.status !== 401 && res.status !== 403
      } catch {
        // connection failed
      }
    }

    if (testOk) {
      return NextResponse.json({
        success: true,
        message: '连接成功，但未能获取模型列表',
      })
    }

    return NextResponse.json({
      success: false,
      message: '连接失败，请检查 API Key 和 Base URL',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, message: `请求异常: ${message}` })
  }
}
