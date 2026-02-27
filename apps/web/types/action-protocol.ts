/**
 * 统一操作协议 (Action Protocol)
 *
 * 定义 TmPlan 中所有实体操作的标准化协议。
 * 每个操作包含类型、来源、上下文和载荷，
 * 通过 ActionHandler 和 ActionMiddleware 实现可组合的操作处理管道。
 */
import { z } from "zod";
import { nanoid } from "nanoid";

// ============================================================
// ActionSource - 操作来源
// ============================================================

/** 操作来源：UI 交互、自然语言、Markdown 解析、Webhook、扩展 */
export const ActionSourceSchema = z.enum([
  "ui",
  "nlp",
  "markdown",
  "webhook",
  "extension",
]);
export type ActionSource = z.infer<typeof ActionSourceSchema>;

// ============================================================
// ActionType - 操作类型枚举
// ============================================================

/** 所有支持的操作类型 */
export const ActionTypeSchema = z.enum([
  "task.create",
  "task.update",
  "task.delete",
  "task.move",
  "module.create",
  "module.update",
  "module.delete",
  "decision.create",
  "decision.update",
  "phase.create",
  "phase.update",
  "project.update",
  "status.sync",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

// ============================================================
// ActionPayload - 各操作的 payload 联合类型
// ============================================================

/** 任务创建载荷 */
export const TaskCreatePayloadSchema = z.object({
  type: z.literal("task.create"),
  /** 目标模块 slug */
  module_slug: z.string(),
  /** 任务数据（部分字段，id 可自动生成） */
  data: z.record(z.string(), z.unknown()),
});

/** 任务更新载荷 */
export const TaskUpdatePayloadSchema = z.object({
  type: z.literal("task.update"),
  /** 要更新的字段 */
  changes: z.record(z.string(), z.unknown()),
});

/** 任务删除载荷 */
export const TaskDeletePayloadSchema = z.object({
  type: z.literal("task.delete"),
  /** 是否级联删除依赖此任务的其他任务 */
  cascade: z.boolean().default(false),
});

/** 任务移动载荷 */
export const TaskMovePayloadSchema = z.object({
  type: z.literal("task.move"),
  /** 源模块 slug */
  from_module: z.string(),
  /** 目标模块 slug */
  to_module: z.string(),
  /** 在目标模块中的插入位置（索引） */
  position: z.number().int().min(0).optional(),
});

/** 模块创建载荷 */
export const ModuleCreatePayloadSchema = z.object({
  type: z.literal("module.create"),
  /** 模块数据 */
  data: z.record(z.string(), z.unknown()),
});

/** 模块更新载荷 */
export const ModuleUpdatePayloadSchema = z.object({
  type: z.literal("module.update"),
  /** 要更新的字段 */
  changes: z.record(z.string(), z.unknown()),
});

/** 模块删除载荷 */
export const ModuleDeletePayloadSchema = z.object({
  type: z.literal("module.delete"),
  /** 是否级联删除模块下的所有任务 */
  cascade: z.boolean().default(true),
});

/** 决策创建载荷 */
export const DecisionCreatePayloadSchema = z.object({
  type: z.literal("decision.create"),
  /** 决策数据 */
  data: z.record(z.string(), z.unknown()),
});

/** 决策更新载荷 */
export const DecisionUpdatePayloadSchema = z.object({
  type: z.literal("decision.update"),
  /** 要更新的字段 */
  changes: z.record(z.string(), z.unknown()),
});

/** 阶段创建载荷 */
export const PhaseCreatePayloadSchema = z.object({
  type: z.literal("phase.create"),
  /** 阶段数据 */
  data: z.record(z.string(), z.unknown()),
});

/** 阶段更新载荷 */
export const PhaseUpdatePayloadSchema = z.object({
  type: z.literal("phase.update"),
  /** 要更新的字段 */
  changes: z.record(z.string(), z.unknown()),
});

/** 项目更新载荷 */
export const ProjectUpdatePayloadSchema = z.object({
  type: z.literal("project.update"),
  /** 要更新的字段 */
  changes: z.record(z.string(), z.unknown()),
});

/** 状态同步载荷 */
export const StatusSyncPayloadSchema = z.object({
  type: z.literal("status.sync"),
  /** 同步来源路径 */
  source_path: z.string().default(""),
  /** 是否强制全量同步 */
  force: z.boolean().default(false),
});

/** 操作载荷联合类型 */
export const ActionPayloadSchema = z.discriminatedUnion("type", [
  TaskCreatePayloadSchema,
  TaskUpdatePayloadSchema,
  TaskDeletePayloadSchema,
  TaskMovePayloadSchema,
  ModuleCreatePayloadSchema,
  ModuleUpdatePayloadSchema,
  ModuleDeletePayloadSchema,
  DecisionCreatePayloadSchema,
  DecisionUpdatePayloadSchema,
  PhaseCreatePayloadSchema,
  PhaseUpdatePayloadSchema,
  ProjectUpdatePayloadSchema,
  StatusSyncPayloadSchema,
]);
export type ActionPayload = z.infer<typeof ActionPayloadSchema>;

// ============================================================
// ActionContext - 操作上下文
// ============================================================

/** 操作上下文，记录操作的来源、执行者和关联信息 */
export const ActionContextSchema = z.object({
  /** 操作来源 */
  source: ActionSourceSchema,
  /** 用户或系统标识 */
  actor: z.string(),
  /** 操作时间（ISO 8601） */
  timestamp: z.string().default(() => new Date().toISOString()),
  /** 关联 ID，用于将同一批操作关联在一起 */
  correlation_id: z.string().default(() => `cor_${nanoid(12)}`),
  /** 附加元数据 */
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type ActionContext = z.infer<typeof ActionContextSchema>;

// ============================================================
// Action - 完整操作定义
// ============================================================

/** Action ID 格式 */
export const actionIdPattern = /^action_[A-Za-z0-9_-]{12}$/;

/** 生成 Action ID */
export function generateActionId(): string {
  return `action_${nanoid(12)}`;
}

/** 完整操作定义，包含类型、目标、载荷和上下文 */
export const ActionSchema = z.object({
  /** 操作唯一标识 */
  id: z.string().regex(actionIdPattern).default(generateActionId),
  /** 操作类型 */
  type: ActionTypeSchema,
  /** 目标实体的 ppf_id */
  target_id: z.string(),
  /** 操作载荷 */
  payload: ActionPayloadSchema,
  /** 操作上下文 */
  context: ActionContextSchema,
});
export type Action = z.infer<typeof ActionSchema>;

// ============================================================
// ActionResult - 操作结果
// ============================================================

/** 操作产生的事件摘要 */
export const ActionEventSummarySchema = z.object({
  /** 事件 ID */
  event_id: z.string(),
  /** 事件类型 */
  type: z.string(),
});

/** 操作执行结果 */
export const ActionResultSchema = z.object({
  /** 是否成功 */
  success: z.boolean(),
  /** 关联的操作 ID */
  action_id: z.string(),
  /** 操作前的实体快照 */
  snapshot_before: z.unknown().default(null),
  /** 操作后的实体快照 */
  snapshot_after: z.unknown().default(null),
  /** 操作产生的事件列表 */
  events: z.array(ActionEventSummarySchema).default([]),
  /** 错误信息列表 */
  errors: z.array(z.string()).default([]),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ============================================================
// ActionHandler / ActionMiddleware 接口类型
// ============================================================

/** 操作处理器：接收 Action 和当前项目状态，返回操作结果 */
export type ActionHandler = (
  action: Action,
  state: unknown
) => ActionResult | Promise<ActionResult>;

/** 操作中间件：可在操作执行前后插入逻辑 */
export type ActionMiddleware = (
  action: Action,
  next: (action: Action) => ActionResult | Promise<ActionResult>
) => ActionResult | Promise<ActionResult>;
