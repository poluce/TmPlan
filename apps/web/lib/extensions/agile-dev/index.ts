/**
 * 内置敏捷开发扩展
 *
 * 为 PPF 任务注入敏捷开发相关字段：
 * - story_points: 故事点（斐波那契数列）
 * - sprint: 冲刺迭代标识
 * - task_type: 任务类型（feature / bug / chore / spike）
 * - branch: Git 分支名
 * - pr_url: Pull Request 链接
 * - reviewer: 代码审查人
 *
 * 同时提供 LLM 提示和 Markdown 渲染模板。
 */

import { z } from "zod";
import type { ExtensionManifest } from "@/types/extension";

// ============================================================
// Zod Schema - 敏捷开发任务扩展字段
// ============================================================

/** 斐波那契故事点 */
export const StoryPointsSchema = z
  .number()
  .refine((v) => [1, 2, 3, 5, 8, 13, 21].includes(v), {
    message: "story_points 必须是斐波那契数列值: 1, 2, 3, 5, 8, 13, 21",
  });

/** 任务类型 */
export const TaskTypeSchema = z.enum(["feature", "bug", "chore", "spike"]);
export type AgileTaskType = z.infer<typeof TaskTypeSchema>;

/** 敏捷开发任务扩展数据 Schema */
export const AgileDevTaskExtSchema = z.object({
  /** 故事点（斐波那契数列：1/2/3/5/8/13/21） */
  story_points: StoryPointsSchema.optional(),
  /** 冲刺迭代标识（如 "Sprint 23"） */
  sprint: z.string().optional(),
  /** 任务类型 */
  task_type: TaskTypeSchema.optional(),
  /** Git 分支名（如 "feat/ppf_xxx-user-auth"） */
  branch: z.string().optional(),
  /** Pull Request 链接 */
  pr_url: z.string().url().optional(),
  /** 代码审查人 */
  reviewer: z.string().optional(),
});
export type AgileDevTaskExt = z.infer<typeof AgileDevTaskExtSchema>;

// ============================================================
// 任务类型 Emoji 映射
// ============================================================

/** 任务类型对应的 Emoji */
const TASK_TYPE_EMOJI: Readonly<Record<AgileTaskType, string>> = {
  feature: "\u2728",  // ✨
  bug: "\uD83D\uDC1B",      // 🐛
  chore: "\uD83D\uDD27",    // 🔧
  spike: "\uD83D\uDD2C",    // 🔬
};

/** 任务类型对应的中文标签 */
const TASK_TYPE_LABEL: Readonly<Record<AgileTaskType, string>> = {
  feature: "功能",
  bug: "缺陷",
  chore: "技术债务",
  spike: "技术调研",
};

// ============================================================
// Markdown 渲染模板
// ============================================================

/**
 * 渲染任务类型字段
 *
 * 根据类型显示对应的 emoji 和中文标签。
 * 模板中 {value} 会被替换为实际值，但这里需要自定义逻辑，
 * 所以使用函数式渲染。
 */
function renderTaskType(value: unknown): string {
  const type = String(value) as AgileTaskType;
  const emoji = TASK_TYPE_EMOJI[type] ?? "";
  const label = TASK_TYPE_LABEL[type] ?? type;
  return `${emoji} ${label}`;
}

// ============================================================
// 扩展清单
// ============================================================

/**
 * 敏捷开发扩展清单
 *
 * 注册到 ExtensionRegistry 后，任务实体的 extensions["agile-dev"]
 * 字段将按此清单进行验证和渲染。
 */
export const agileDevManifest: ExtensionManifest = {
  id: "agile-dev",
  name: "敏捷开发",
  version: "1.0.0",
  description:
    "为任务添加敏捷开发字段：故事点、冲刺、任务类型、分支、PR 和审查人",
  author: "TmPlan",
  schemas: {
    story_points: {
      type: "number",
      description: "故事点（斐波那契数列：1/2/3/5/8/13/21）",
      enum: [1, 2, 3, 5, 8, 13, 21],
    },
    sprint: {
      type: "string",
      description: "冲刺迭代标识（如 Sprint 23）",
    },
    task_type: {
      type: "string",
      description: "任务类型",
      enum: ["feature", "bug", "chore", "spike"],
    },
    branch: {
      type: "string",
      description: "Git 分支名（如 feat/ppf_xxx-user-auth）",
    },
    pr_url: {
      type: "string",
      description: "Pull Request 链接",
    },
    reviewer: {
      type: "string",
      description: "代码审查人",
    },
  },
  llm_hints: [
    "story_points 表示任务复杂度，使用斐波那契数列（1/2/3/5/8/13/21）",
    "task_type 区分功能开发(feature)、缺陷修复(bug)、技术债务(chore)和技术调研(spike)",
    "branch 命名规范：{type}/ppf_{id}-{description}，如 feat/ppf_V1StGXR8_Z5j-user-auth",
    "sprint 格式为 'Sprint N'，N 为迭代编号",
    "pr_url 应为完整的 GitHub/GitLab PR 链接",
    "reviewer 为代码审查人的用户名或邮箱",
  ],
  markdown_renderers: {
    story_points: "\uD83C\uDFAF {value}点",
    task_type: "{value}",
    sprint: "\uD83C\uDFC3 {value}",
    branch: "\uD83C\uDF3F `{value}`",
    pr_url: "\uD83D\uDD17 [{value}]({value})",
    reviewer: "\uD83D\uDC64 {value}",
  },
  middleware: [],
  entity_types: ["task"],
};

/**
 * 自定义渲染 task_type 字段
 *
 * 由于 markdown_renderers 只支持简单的 {value} 替换，
 * task_type 需要根据值映射不同的 emoji，因此提供此辅助函数。
 * 在实际渲染时可覆盖默认模板。
 */
export { renderTaskType };
