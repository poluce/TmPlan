/**
 * PPF 2.0 核心数据格式
 *
 * PPF (Project Plan Format) 是 TmPlan 的标准化项目计划数据格式。
 * 所有实体都包含 ppf_id 和 extensions 字段，支持扩展系统。
 * v1.0 数据可通过 Zod 默认值机制无缝兼容。
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ModuleTaskSchema,
  ModulePlanSchema,
  DecisionSchema,
  PhaseConfigSchema,
  ProjectConfigSchema,
} from "./tmplan";

// ============================================================
// PPF ID
// ============================================================

/** PPF ID 正则：ppf_ 前缀 + 12 位 nanoid 字符 */
export const ppfIdPattern = /^ppf_[A-Za-z0-9_-]{12}$/;

/** PPF ID Schema */
export const PPFIdSchema = z.string().regex(ppfIdPattern);

/** 生成一个新的 PPF ID */
export function generatePPFId(): string {
  return `ppf_${nanoid(12)}`;
}

/** 扩展沙箱数据 Schema */
export const ExtensionsSchema = z.record(z.string(), z.unknown()).default({});

// ============================================================
// PPFTask - 基于 ModuleTask 扩展
// ============================================================

/** PPF 任务，在 ModuleTask 基础上增加 ppf_id、扩展数据、负责人、标签、截止日期 */
export const PPFTaskSchema = ModuleTaskSchema.extend({
  /** 全局唯一标识 */
  ppf_id: PPFIdSchema.default(generatePPFId),
  /** 扩展沙箱数据 */
  extensions: ExtensionsSchema,
  /** 任务负责人 */
  assignee: z.string().default(""),
  /** 标签列表 */
  tags: z.array(z.string()).default([]),
  /** 截止日期（ISO 8601） */
  due_date: z.string().nullable().default(null),
});
export type PPFTask = z.infer<typeof PPFTaskSchema>;

// ============================================================
// PPFModule - 基于 ModulePlan 扩展
// ============================================================

/** PPF 模块，在 ModulePlan 基础上增加 ppf_id、扩展数据、标签、来源，tasks 升级为 PPFTask */
export const PPFModuleSchema = ModulePlanSchema.extend({
  /** 全局唯一标识 */
  ppf_id: PPFIdSchema.default(generatePPFId),
  /** 扩展沙箱数据 */
  extensions: ExtensionsSchema,
  /** 标签列表 */
  tags: z.array(z.string()).default([]),
  /** 模块来源描述（如 "ai-generated"、"manual"） */
  source: z.string().default(""),
  /** 任务列表（升级为 PPFTask） */
  tasks: z.array(PPFTaskSchema),
});
export type PPFModule = z.infer<typeof PPFModuleSchema>;

// ============================================================
// PPFDecision - 基于 Decision 扩展
// ============================================================

/** PPF 决策记录，在 Decision 基础上增加 ppf_id 和扩展数据 */
export const PPFDecisionSchema = DecisionSchema.extend({
  /** 全局唯一标识 */
  ppf_id: PPFIdSchema.default(generatePPFId),
  /** 扩展沙箱数据 */
  extensions: ExtensionsSchema,
});
export type PPFDecision = z.infer<typeof PPFDecisionSchema>;

// ============================================================
// PPFPhase - 基于 PhaseConfig 扩展
// ============================================================

/** PPF 阶段，在 PhaseConfig 基础上增加 ppf_id 和扩展数据 */
export const PPFPhaseSchema = PhaseConfigSchema.extend({
  /** 全局唯一标识 */
  ppf_id: PPFIdSchema.default(generatePPFId),
  /** 扩展沙箱数据 */
  extensions: ExtensionsSchema,
});
export type PPFPhase = z.infer<typeof PPFPhaseSchema>;

// ============================================================
// PPFProject - 基于 ProjectConfig 扩展
// ============================================================

/** 项目元数据 */
export const PPFProjectMetadataSchema = z.object({
  /** 目标用户群体 */
  target_users: z.array(z.string()).default([]),
  /** UI 页面列表 */
  ui_pages: z.array(z.string()).default([]),
  /** 项目来源描述 */
  source: z.string().default(""),
  /** 标签列表 */
  tags: z.array(z.string()).default([]),
});
export type PPFProjectMetadata = z.infer<typeof PPFProjectMetadataSchema>;

/** 计划状态枚举 */
export const PPFPlanStatusSchema = z
  .enum(["draft", "active", "archived", "completed"])
  .default("draft");
export type PPFPlanStatus = z.infer<typeof PPFPlanStatusSchema>;

/** PPF 项目，在 ProjectConfig 基础上升级为 2.0 格式 */
export const PPFProjectSchema = ProjectConfigSchema.extend({
  /** 固定为 "2.0" */
  schema_version: z.literal("2.0").default("2.0"),
  /** 全局唯一标识 */
  ppf_id: PPFIdSchema.default(generatePPFId),
  /** 扩展沙箱数据 */
  extensions: ExtensionsSchema,
  /** 计划版本号（递增） */
  plan_version: z.number().int().min(1).default(1),
  /** 计划状态 */
  plan_status: PPFPlanStatusSchema,
  /** 项目元数据 */
  metadata: PPFProjectMetadataSchema.default({
    target_users: [],
    ui_pages: [],
    source: "",
    tags: [],
  }),
  /** 模块列表 */
  modules: z.array(PPFModuleSchema).default([]),
  /** 决策列表 */
  decisions: z.array(PPFDecisionSchema).default([]),
  /** 阶段列表 */
  phases: z.array(PPFPhaseSchema).default([]),
});
export type PPFProject = z.infer<typeof PPFProjectSchema>;
