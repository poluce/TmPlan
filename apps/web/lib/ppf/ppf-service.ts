/**
 * PPF Service 层 — 核心枢纽
 *
 * 封装 ActionDispatcher + EventStore，提供统一的操作入口。
 * 所有写操作都经过 dispatch → appendEvent 流程，确保事件溯源完整性。
 */

import { ActionDispatcher, generatePatches } from "./action-dispatcher"
import { registerAllHandlers } from "./handlers"
import { appendEvent, queryEvents } from "./event-store"
import { renderProjectToMarkdown, type RenderOptions } from "./markdown-renderer"
import { parseMarkdownToPPF, type ParseResult } from "./markdown-parser"
import { readAllModules, readProject } from "@/lib/tmplan/reader"
import { writeModule } from "@/lib/tmplan/writer"
import { migrateModule } from "./migrate"
import type { Action, ActionResult } from "@/types/action-protocol"
import { generateActionId } from "@/types/action-protocol"
import { generateEventId, type PPFEvent, type EventQuery } from "@/types/event-sourcing"
import type { PPFProject, PPFModule } from "@/types/ppf"
import type { ModulePlan, TaskStatus } from "@/types/tmplan"

// ============================================================
// PPFService 单例
// ============================================================

class PPFService {
  private readonly dispatcher: ActionDispatcher

  constructor() {
    this.dispatcher = new ActionDispatcher()
    registerAllHandlers(this.dispatcher)
  }

  /**
   * 执行 Action 并记录事件
   */
  async execute(
    basePath: string,
    action: Action,
    state: unknown
  ): Promise<ActionResult> {
    const result = await this.dispatcher.dispatch(action, state)

    if (result.success) {
      const patches = generatePatches(result.snapshot_before, result.snapshot_after)
      const event: PPFEvent = {
        event_id: generateEventId(),
        action_id: action.id,
        timestamp: new Date().toISOString(),
        type: action.type,
        target_id: action.target_id,
        patches,
        actor: action.context.actor,
        source: action.context.source,
      }
      await appendEvent(basePath, event)
    }

    return result
  }

  /**
   * 变更任务状态 — 便捷方法
   *
   * 1. 读取当前模块
   * 2. 找到任务，更新状态
   * 3. 写回文件
   * 4. 记录事件
   */
  async changeTaskStatus(
    basePath: string,
    moduleSlug: string,
    taskId: string,
    newStatus: TaskStatus,
    actor: string = "user"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const modules = await readAllModules(basePath)
      const mod = modules.find((m) => m.slug === moduleSlug)
      if (!mod) {
        return { success: false, error: `模块 "${moduleSlug}" 不存在` }
      }

      const task = mod.tasks.find((t) => t.id === taskId)
      if (!task) {
        return { success: false, error: `任务 "${taskId}" 不存在` }
      }

      const oldStatus = task.status
      if (oldStatus === newStatus) {
        return { success: true }
      }

      // 不可变更新
      const now = new Date().toISOString()
      const updatedModule: ModulePlan = {
        ...mod,
        tasks: mod.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
        updated_at: now,
      }

      await writeModule(basePath, updatedModule)

      // 记录事件
      const event: PPFEvent = {
        event_id: generateEventId(),
        action_id: generateActionId(),
        timestamp: now,
        type: "task.update",
        target_id: taskId,
        patches: [
          {
            op: "replace",
            path: `/modules/${moduleSlug}/tasks/${taskId}/status`,
            value: newStatus,
            old_value: oldStatus,
          },
        ],
        actor,
        source: "ui",
      }
      await appendEvent(basePath, event)

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误"
      return { success: false, error: message }
    }
  }

  /**
   * 查询事件
   */
  async getEvents(basePath: string, query: EventQuery): Promise<PPFEvent[]> {
    return queryEvents(basePath, query)
  }

  /**
   * 导出 Markdown（带锚点）
   *
   * 读取项目和模块，迁移为 PPF 格式后渲染。
   */
  async exportMarkdown(
    basePath: string,
    options?: Partial<RenderOptions>
  ): Promise<string> {
    const [project, modules] = await Promise.all([
      readProject(basePath),
      readAllModules(basePath),
    ])

    // 迁移为 PPF 格式（添加 ppf_id 等字段）
    const ppfProject = {
      ...project,
      schema_version: "2.0" as const,
      ppf_id: (project as Record<string, unknown>).ppf_id as string ?? `ppf_project_temp`,
      extensions: {},
      plan_version: 1,
      plan_status: "active" as const,
      metadata: { target_users: [], ui_pages: [], source: "", tags: [] },
      modules: [],
      decisions: [],
      phases: [],
    } satisfies PPFProject

    const ppfModules = modules.map((m) => migrateModule(m))

    return renderProjectToMarkdown(ppfProject, ppfModules, options)
  }

  /**
   * 导入 Markdown（AST 解析）
   */
  importMarkdown(markdown: string): ParseResult {
    return parseMarkdownToPPF(markdown)
  }
}

// 单例导出
export const ppfService = new PPFService()
