/**
 * 轻量级事件溯源类型 (Event Sourcing)
 *
 * 基于 JSON Patch 的事件记录系统，支持按日期分片存储、
 * 版本标签和灵活的事件查询。用于实现操作历史回溯和撤销/重做。
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { ActionTypeSchema, ActionSourceSchema } from "./action-protocol";

// ============================================================
// JSONPatchOp - JSON Patch 操作
// ============================================================

/** JSON Patch 操作类型 */
export const JSONPatchOpTypeSchema = z.enum([
  "add",
  "remove",
  "replace",
  "move",
  "copy",
]);

/** JSON Patch 单个操作，扩展了 old_value 用于回滚 */
export const JSONPatchOpSchema = z.object({
  /** 操作类型 */
  op: JSONPatchOpTypeSchema,
  /** JSON Pointer 路径 */
  path: z.string(),
  /** 新值（add/replace/copy 时必填） */
  value: z.unknown().optional(),
  /** 旧值（用于回滚，replace/remove 时记录） */
  old_value: z.unknown().optional(),
  /** 源路径（move/copy 时使用） */
  from: z.string().optional(),
});
export type JSONPatchOp = z.infer<typeof JSONPatchOpSchema>;

// ============================================================
// PPFEvent - 事件记录
// ============================================================

/** 事件 ID 格式 */
export const eventIdPattern = /^evt_[A-Za-z0-9_-]{12}$/;

/** 生成事件 ID */
export function generateEventId(): string {
  return `evt_${nanoid(12)}`;
}

/** PPF 事件记录，关联到具体的 Action，包含 JSON Patch 变更 */
export const PPFEventSchema = z.object({
  /** 事件唯一标识 */
  event_id: z.string().regex(eventIdPattern).default(generateEventId),
  /** 关联的 Action ID */
  action_id: z.string(),
  /** 事件时间（ISO 8601） */
  timestamp: z.string().default(() => new Date().toISOString()),
  /** 事件类型（与 Action 类型一致） */
  type: ActionTypeSchema,
  /** 目标实体的 ppf_id */
  target_id: z.string(),
  /** 变更的 JSON Patch 操作列表 */
  patches: z.array(JSONPatchOpSchema).default([]),
  /** 操作执行者 */
  actor: z.string(),
  /** 操作来源 */
  source: ActionSourceSchema,
});
export type PPFEvent = z.infer<typeof PPFEventSchema>;

// ============================================================
// EventDayLog - 按日期分片的事件日志
// ============================================================

/** 日期格式正则 (YYYY-MM-DD) */
export const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** 按日期分片的事件日志，每天一个文件 */
export const EventDayLogSchema = z.object({
  /** 日期（YYYY-MM-DD） */
  date: z.string().regex(datePattern),
  /** 当天的事件列表 */
  events: z.array(PPFEventSchema).default([]),
});
export type EventDayLog = z.infer<typeof EventDayLogSchema>;

// ============================================================
// VersionTag - 版本标签
// ============================================================

/** 版本标签，用于标记重要的事件节点 */
export const VersionTagSchema = z.object({
  /** 标签名称（如 "v1.0"、"milestone-1"） */
  tag: z.string(),
  /** 标记点的事件 ID */
  event_id: z.string(),
  /** 创建时间（ISO 8601） */
  created_at: z.string().default(() => new Date().toISOString()),
  /** 标签描述 */
  description: z.string().default(""),
});
export type VersionTag = z.infer<typeof VersionTagSchema>;

// ============================================================
// EventQuery - 事件查询条件
// ============================================================

/** 事件查询条件，支持多维度过滤 */
export const EventQuerySchema = z.object({
  /** 起始日期（YYYY-MM-DD，包含） */
  from_date: z.string().regex(datePattern).optional(),
  /** 结束日期（YYYY-MM-DD，包含） */
  to_date: z.string().regex(datePattern).optional(),
  /** 按目标实体 ppf_id 过滤 */
  target_id: z.string().optional(),
  /** 按事件类型过滤 */
  type: ActionTypeSchema.optional(),
  /** 按操作者过滤 */
  actor: z.string().optional(),
  /** 按来源过滤 */
  source: ActionSourceSchema.optional(),
  /** 返回结果数量上限 */
  limit: z.number().int().min(1).default(100),
  /** 跳过的结果数量（分页） */
  offset: z.number().int().min(0).default(0),
});
export type EventQuery = z.infer<typeof EventQuerySchema>;

// ============================================================
// EventStoreConfig - 事件存储配置
// ============================================================

/** 事件存储配置 */
export const EventStoreConfigSchema = z.object({
  /** 事件日志文件的基础路径 */
  base_path: z.string(),
  /** 单个文件最大事件数（超出后自动分片） */
  max_events_per_file: z.number().int().min(100).default(1000),
  /** 事件保留天数 */
  retention_days: z.number().int().min(1).default(365),
});
export type EventStoreConfig = z.infer<typeof EventStoreConfigSchema>;
