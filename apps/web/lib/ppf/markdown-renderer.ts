/**
 * PPF -> Markdown 导出渲染器
 *
 * 将 PPFProject 及其模块渲染为带隐藏锚点的 Markdown 文档。
 * 锚点格式：<!-- ppf:type:ppf_id -->，用于双向同步时的实体匹配。
 *
 * 输出包含 YAML frontmatter、项目概览、技术栈、模块列表和任务清单。
 */

import type { PPFProject, PPFModule, PPFTask } from "@/types/ppf";

// ============================================================
// RenderOptions - 渲染选项
// ============================================================

/** Markdown 渲染选项 */
export interface RenderOptions {
  /** 是否包含 PPF 锚点注释（默认 true） */
  readonly includeAnchors: boolean;
  /** 是否包含扩展字段数据（默认 false） */
  readonly includeExtensions: boolean;
  /** 是否包含决策记录（默认 true） */
  readonly includeDecisions: boolean;
  /** 是否包含 YAML frontmatter（默认 true） */
  readonly includeFrontmatter: boolean;
}

/** 默认渲染选项 */
const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  includeAnchors: true,
  includeExtensions: false,
  includeDecisions: true,
  includeFrontmatter: true,
};

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 生成 PPF 锚点注释
 * @param type - 实体类型（project / module / task）
 * @param ppfId - 实体的 ppf_id
 */
function anchor(type: string, ppfId: string): string {
  return `<!-- ppf:${type}:${ppfId} -->`;
}

/**
 * 渲染任务状态为 checkbox 标记
 * @param status - 任务状态
 */
function taskCheckbox(status: string): string {
  return status === "completed" ? "[x]" : "[ ]";
}

/**
 * 渲染模块状态为中文标签
 * @param status - 模块状态
 */
function renderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: "pending",
    in_progress: "in_progress",
    completed: "completed",
  };
  return statusMap[status] ?? status;
}

/**
 * 渲染优先级为中文标签
 * @param priority - 优先级
 */
function renderPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: "low",
    medium: "medium",
    high: "high",
    critical: "critical",
  };
  return priorityMap[priority] ?? priority;
}

/**
 * 渲染扩展字段数据为 Markdown 列表
 * @param extensions - 扩展沙箱数据
 */
function renderExtensions(extensions: Record<string, unknown>): string {
  const entries = Object.entries(extensions);
  if (entries.length === 0) return "";

  const lines: string[] = ["", "#### 扩展数据"];
  for (const [extId, data] of entries) {
    lines.push(`- **${extId}**: \`${JSON.stringify(data)}\``);
  }
  return lines.join("\n");
}

// ============================================================
// YAML Frontmatter 渲染
// ============================================================

/**
 * 渲染 YAML frontmatter
 * @param project - PPF 项目
 */
function renderFrontmatter(project: PPFProject): string {
  const lines = [
    "---",
    `ppf_version: "${project.schema_version}"`,
    `ppf_project_id: "${project.ppf_id}"`,
    `exported_at: "${new Date().toISOString()}"`,
    "---",
  ];
  return lines.join("\n");
}

// ============================================================
// 任务渲染
// ============================================================

/**
 * 渲染单个任务为 Markdown 列表项
 * @param task - PPF 任务
 * @param options - 渲染选项
 */
function renderTask(task: PPFTask, options: RenderOptions): string {
  const checkbox = taskCheckbox(task.status);
  const anchorStr = options.includeAnchors
    ? ` ${anchor("task", task.ppf_id)}`
    : "";
  return `- ${checkbox} \`${task.id}\` ${task.title}${anchorStr}`;
}

// ============================================================
// 模块渲染
// ============================================================

/**
 * 渲染单个模块为 Markdown 段落
 * @param mod - PPF 模块
 * @param options - 渲染选项
 */
function renderModule(mod: PPFModule, options: RenderOptions): string {
  const lines: string[] = [];

  // 模块标题
  lines.push(`### ${mod.module} (\`${mod.slug}\`)`);

  // 锚点
  if (options.includeAnchors) {
    lines.push(anchor("module", mod.ppf_id));
  }

  // 元数据行
  const metaParts: string[] = [
    `**状态**: ${renderStatus(mod.status)}`,
    `**优先级**: ${renderPriority(mod.priority ?? "medium")}`,
  ];
  if (mod.depends_on.length > 0) {
    metaParts.push(`**依赖**: ${mod.depends_on.join(", ")}`);
  }
  lines.push(metaParts.join(" | "));

  // 概述
  if (mod.overview) {
    lines.push("");
    lines.push(mod.overview);
  }

  // 扩展数据
  if (options.includeExtensions && mod.extensions) {
    const extStr = renderExtensions(
      mod.extensions as Record<string, unknown>
    );
    if (extStr) {
      lines.push(extStr);
    }
  }

  // 任务列表
  if (mod.tasks.length > 0) {
    lines.push("");
    lines.push("#### 任务");
    for (const task of mod.tasks) {
      lines.push(renderTask(task, options));
    }
  }

  return lines.join("\n");
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 将 PPFProject 渲染为带隐藏锚点的 Markdown 文档
 *
 * 输出结构：
 * 1. YAML frontmatter（可选）
 * 2. 项目标题 + 锚点
 * 3. 项目描述
 * 4. 技术栈列表
 * 5. 模块列表（含任务）
 *
 * @param project - PPF 项目数据
 * @param modules - PPF 模块列表
 * @param options - 渲染选项（可选）
 * @returns 渲染后的 Markdown 字符串
 */
export function renderProjectToMarkdown(
  project: PPFProject,
  modules: readonly PPFModule[],
  options?: Partial<RenderOptions>
): string {
  const opts: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const sections: string[] = [];

  // Frontmatter
  if (opts.includeFrontmatter) {
    sections.push(renderFrontmatter(project));
  }

  // 项目标题
  const titleAnchor = opts.includeAnchors
    ? `\n${anchor("project", project.ppf_id)}`
    : "";
  sections.push(`# ${project.name}${titleAnchor}`);

  // 项目描述
  if (project.description) {
    sections.push(`> ${project.description}`);
  }

  // 技术栈
  if (project.tech_stack.length > 0) {
    const techLines = ["## 技术栈"];
    for (const tech of project.tech_stack) {
      techLines.push(`- ${tech}`);
    }
    sections.push(techLines.join("\n"));
  }

  // 模块列表
  if (modules.length > 0) {
    const moduleLines = ["## 模块"];
    for (const mod of modules) {
      moduleLines.push("");
      moduleLines.push(renderModule(mod, opts));
    }
    sections.push(moduleLines.join("\n"));
  }

  return sections.join("\n\n") + "\n";
}
