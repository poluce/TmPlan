import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

test('convert prompt requires Chinese project, module, and task titles', async () => {
  const filePath = join(process.cwd(), 'app', 'api', 'plans', '[projectPath]', 'convert', 'route.ts')
  const source = await readFile(filePath, 'utf-8')

  assert.match(source, /项目名称（project_name）、模块名称（module）和任务标题（title）优先使用中文/i)
  assert.match(source, /模块名称（module）必须使用中文/i)
  assert.match(source, /任务详情（detail）、模块概述（overview）和项目描述（project_description）优先使用中文/i)
  assert.match(source, /slug 字段仍使用纯小写字母、数字和连字符/i)
})
