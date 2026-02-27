/**
 * 扩展系统类型 (Extension System)
 *
 * 定义 TmPlan 扩展的清单、配置、注册表和钩子机制。
 * 扩展可以为实体添加自定义字段、中间件和渲染模板，
 * 并通过 llm_hints 为 AI 提供字段语义描述。
 */
import { z } from "zod";

// ============================================================
// ExtensionManifest - 扩展清单
// ============================================================

/** 扩展适用的实体类型 */
export const ExtensionEntityTypeSchema = z.enum([
  "task",
  "module",
  "decision",
  "phase",
  "project",
]);
export type ExtensionEntityType = z.infer<typeof ExtensionEntityTypeSchema>;

/** semver 格式正则 */
export const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

/** 扩展清单，描述扩展的元信息、schema、渲染和中间件 */
export const ExtensionManifestSchema = z.object({
  /** 扩展唯一标识（如 "agile-dev"、"time-tracking"） */
  id: z.string(),
  /** 扩展显示名称 */
  name: z.string(),
  /** 版本号（semver 格式） */
  version: z.string().regex(semverPattern),
  /** 扩展描述 */
  description: z.string().default(""),
  /** 作者 */
  author: z.string().default(""),
  /**
   * 扩展定义的 schema（序列化形式）。
   * key 为字段名，value 为 JSON Schema 或自定义描述对象。
   * 运行时会转换为 Zod schema 进行校验。
   */
  schemas: z.record(z.string(), z.unknown()).default({}),
  /** 给 AI 的提示列表，描述扩展字段的含义和用法 */
  llm_hints: z.array(z.string()).default([]),
  /**
   * Markdown 渲染模板。
   * key 为字段名，value 为 Handlebars/Mustache 风格的模板字符串。
   */
  markdown_renderers: z.record(z.string(), z.string()).default({}),
  /** 中间件标识符列表，按顺序执行 */
  middleware: z.array(z.string()).default([]),
  /** 扩展适用的实体类型列表 */
  entity_types: z.array(ExtensionEntityTypeSchema).default([]),
});
export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

// ============================================================
// ExtensionConfig - 扩展配置（用户级）
// ============================================================

/** 用户级扩展配置，控制扩展的启用状态和个性化设置 */
export const ExtensionConfigSchema = z.object({
  /** 扩展 ID */
  extension_id: z.string(),
  /** 是否启用 */
  enabled: z.boolean().default(true),
  /** 用户自定义设置 */
  settings: z.record(z.string(), z.unknown()).default({}),
});
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

// ============================================================
// ExtensionRegistryState - 注册表状态
// ============================================================

/** 扩展注册表中的扩展条目（序列化形式） */
export const ExtensionRegistryEntrySchema = z.object({
  /** 扩展 ID */
  id: z.string(),
  /** 扩展清单 */
  manifest: ExtensionManifestSchema,
});

/** 扩展注册表状态，管理所有已注册的扩展及其配置 */
export const ExtensionRegistryStateSchema = z.object({
  /** 已注册的扩展列表（Map<string, ExtensionManifest> 的序列化形式） */
  extensions: z.array(ExtensionRegistryEntrySchema).default([]),
  /** 用户级扩展配置列表 */
  configs: z.array(ExtensionConfigSchema).default([]),
});
export type ExtensionRegistryState = z.infer<
  typeof ExtensionRegistryStateSchema
>;

// ============================================================
// ExtensionHook - 扩展钩子
// ============================================================

/** 扩展钩子类型，定义扩展可以介入的时机 */
export const ExtensionHookSchema = z.enum([
  "before_action",
  "after_action",
  "on_render",
  "on_validate",
]);
export type ExtensionHook = z.infer<typeof ExtensionHookSchema>;

// ============================================================
// ExtensionContext - 扩展执行上下文
// ============================================================

/** 扩展执行上下文，在钩子触发时传递给扩展 */
export const ExtensionContextSchema = z.object({
  /** 当前扩展 ID */
  extension_id: z.string(),
  /** 目标实体类型 */
  entity_type: ExtensionEntityTypeSchema,
  /** 目标实体的 ppf_id */
  entity_id: z.string(),
  /** 当前实体的扩展沙箱数据 */
  extensions_data: z.record(z.string(), z.unknown()).default({}),
});
export type ExtensionContext = z.infer<typeof ExtensionContextSchema>;
