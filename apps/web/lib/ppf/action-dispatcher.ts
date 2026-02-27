/**
 * Action 分发器
 *
 * 核心职责：
 * - 管理中间件链和处理器注册
 * - 分发 Action 到对应 Handler
 * - 生成 JSON Patch diff（含 old_value 用于回滚）
 * - 创建 PPFEvent
 * - 确保不可变性（不修改传入的 state）
 */

import type {
  Action,
  ActionType,
  ActionHandler,
  ActionMiddleware,
  ActionResult,
} from "@/types/action-protocol";
import {
  generateEventId,
  type PPFEvent,
  type JSONPatchOp,
} from "@/types/event-sourcing";

/**
 * 生成 JSON Patch 差异（含 old_value 用于回滚）
 *
 * 对比 before 和 after 两个对象，生成 JSON Patch 操作列表。
 * 仅处理 add / remove / replace 三种操作。
 * replace 和 remove 操作会记录 old_value 以支持回滚。
 *
 * @param before - 变更前的对象
 * @param after - 变更后的对象
 * @param basePath - 当前路径前缀（递归用）
 * @returns JSON Patch 操作数组
 */
export function generatePatches(
  before: unknown,
  after: unknown,
  basePath: string = ""
): JSONPatchOp[] {
  if (before === after) return [];

  // 基本类型或 null 直接比较
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object"
  ) {
    const path = basePath || "/";
    return [{ op: "replace", path, value: after, old_value: before }];
  }

  // 数组处理：整体替换（简化策略）
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) {
      const path = basePath || "/";
      return [{ op: "replace", path, value: after, old_value: before }];
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const path = basePath || "/";
      return [{ op: "replace", path, value: after, old_value: before }];
    }
    return [];
  }

  // 对象处理：逐字段比较
  const patches: JSONPatchOp[] = [];
  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const allKeys = new Set([
    ...Object.keys(beforeObj),
    ...Object.keys(afterObj),
  ]);

  for (const key of allKeys) {
    const path = `${basePath}/${key}`;
    const hasBefore = key in beforeObj;
    const hasAfter = key in afterObj;

    if (!hasBefore && hasAfter) {
      patches.push({ op: "add", path, value: afterObj[key] });
    } else if (hasBefore && !hasAfter) {
      patches.push({ op: "remove", path, old_value: beforeObj[key] });
    } else if (hasBefore && hasAfter) {
      patches.push(...generatePatches(beforeObj[key], afterObj[key], path));
    }
  }

  return patches;
}

/**
 * Action 分发器
 *
 * 管理中间件和处理器，将 Action 分发到对应的 Handler 执行。
 * 所有操作都是不可变的 —— dispatch 不修改传入的 state，返回新的 snapshot。
 *
 * 注意：此分发器适配新版 ActionHandler/ActionMiddleware 函数类型签名。
 * - ActionHandler: (action, state) => ActionResult | Promise<ActionResult>
 * - ActionMiddleware: (action, next) => ActionResult | Promise<ActionResult>
 */
export class ActionDispatcher {
  private readonly middlewares: ActionMiddleware[] = [];
  private readonly handlers: Map<ActionType, ActionHandler> = new Map();

  /**
   * 注册中间件
   * @param middleware - 要注册的中间件函数
   */
  use(middleware: ActionMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 注册操作处理器
   * @param type - 操作类型
   * @param handler - 处理器函数
   */
  register(type: ActionType, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * 分发操作
   *
   * 流程：
   * 1. 深拷贝 state 确保不可变性
   * 2. 构建中间件 + handler 执行链
   * 3. 执行链返回 ActionResult
   * 4. 如果 handler 未生成事件，补充生成 PPFEvent
   *
   * @param action - 要分发的操作
   * @param state - 当前项目状态（不会被修改）
   * @returns 操作结果
   */
  async dispatch(action: Action, state: unknown): Promise<ActionResult> {
    const stateBefore = structuredClone(state);

    const handler = this.handlers.get(action.type);
    if (!handler) {
      return {
        success: false,
        action_id: action.id,
        snapshot_before: stateBefore,
        snapshot_after: stateBefore,
        events: [],
        errors: [`未找到操作类型 "${action.type}" 的处理器`],
      };
    }

    try {
      // 构建执行链：middleware[0] -> middleware[1] -> ... -> handler
      const chain = this.buildChain(handler, stateBefore);
      const result = await chain(action);

      // 如果 handler 没有生成事件，补充创建
      if (result.success && result.events.length === 0) {
        const patches = generatePatches(
          result.snapshot_before,
          result.snapshot_after
        );
        const event = this.createEvent(action, patches);
        return {
          ...result,
          events: [{ event_id: event.event_id, type: event.type }],
        };
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误";
      return {
        success: false,
        action_id: action.id,
        snapshot_before: stateBefore,
        snapshot_after: stateBefore,
        events: [],
        errors: [message],
      };
    }
  }

  /**
   * 构建中间件执行链
   * @param handler - 最终的操作处理器
   * @param state - 当前状态
   * @returns 链式执行函数
   */
  private buildChain(
    handler: ActionHandler,
    state: unknown
  ): (action: Action) => ActionResult | Promise<ActionResult> {
    // 最内层：调用 handler
    let next = (action: Action): ActionResult | Promise<ActionResult> =>
      handler(action, state);

    // 从最后一个中间件开始，向前构建链
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const currentNext = next;
      next = (action: Action): ActionResult | Promise<ActionResult> =>
        middleware(action, currentNext);
    }

    return next;
  }

  /**
   * 创建 PPFEvent
   * @param action - 触发事件的操作
   * @param patches - JSON Patch 差异
   * @returns 新的 PPFEvent
   */
  private createEvent(
    action: Action,
    patches: readonly JSONPatchOp[]
  ): PPFEvent {
    return {
      event_id: generateEventId(),
      action_id: action.id,
      timestamp: new Date().toISOString(),
      type: action.type,
      target_id: action.target_id,
      patches: [...patches],
      actor: action.context.actor,
      source: action.context.source,
    };
  }
}
