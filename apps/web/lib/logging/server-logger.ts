import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const DEFAULT_LOGS_ROOT = join(process.cwd(), 'logs')
const LOG_MODULE_NAME = /^[a-z0-9-]+$/

type LogLevel = 'info' | 'warn' | 'error'

interface ServerLogOptions {
  logsRoot?: string
  now?: Date
}

interface AppendServerLogOptions extends ServerLogOptions {
  module: string
  level: LogLevel
  event: string
  metadata: Record<string, unknown>
}

function resolveNow(now?: Date): Date {
  return now ?? new Date()
}

function formatLogDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function assertValidModuleName(moduleName: string): void {
  if (!LOG_MODULE_NAME.test(moduleName)) {
    throw new Error(`Invalid log module: ${moduleName}`)
  }
}

export async function getServerLogFilePath(
  moduleName: string,
  options: ServerLogOptions = {}
): Promise<string> {
  assertValidModuleName(moduleName)

  const logsRoot = options.logsRoot ?? DEFAULT_LOGS_ROOT
  const now = resolveNow(options.now)
  const moduleDir = join(logsRoot, moduleName)
  await mkdir(moduleDir, { recursive: true })

  return join(moduleDir, `${formatLogDate(now)}.log`)
}

export async function appendServerLog(options: AppendServerLogOptions): Promise<void> {
  const now = resolveNow(options.now)
  const filePath = await getServerLogFilePath(options.module, {
    logsRoot: options.logsRoot,
    now,
  })

  const line = JSON.stringify({
    timestamp: now.toISOString(),
    level: options.level,
    module: options.module,
    event: options.event,
    metadata: options.metadata,
  })

  await appendFile(filePath, `${line}\n`, 'utf-8')
}

export async function logServerInfo(
  moduleName: string,
  event: string,
  metadata: Record<string, unknown>,
  options?: ServerLogOptions
): Promise<void> {
  await appendServerLog({ module: moduleName, level: 'info', event, metadata, ...options })
}

export async function logServerWarn(
  moduleName: string,
  event: string,
  metadata: Record<string, unknown>,
  options?: ServerLogOptions
): Promise<void> {
  await appendServerLog({ module: moduleName, level: 'warn', event, metadata, ...options })
}

export async function logServerError(
  moduleName: string,
  event: string,
  metadata: Record<string, unknown>,
  options?: ServerLogOptions
): Promise<void> {
  await appendServerLog({ module: moduleName, level: 'error', event, metadata, ...options })
}
