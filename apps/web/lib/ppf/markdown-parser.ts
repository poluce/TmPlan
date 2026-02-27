/**
 * Markdown -> PPF 导入解析器
 *
 * 使用 unified + remark-parse + remark-frontmatter 将 Markdown 解析为 AST，
 * 然后从 AST 中提取 PPF 结构（项目、模块、任务）。
 *
 * 锚点格式：<!-- ppf:type:ppf_id -->
 * 有锚点的实体表示已存在的 PPF 实体（用于同步更新），
 * 无锚点的实体表示新内容（用于创建）。
 *
 * 注意：unified / remark-parse / remark-frontmatter 需要额外安装。
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import yaml from "js-yaml";
import type { PPFProject } from "@/types/ppf";
import type { Root, Content, Heading, ListItem, Html } from "mdast";

// ============================================================
// 解析结果类型
// ============================================================

/** 解析出的任务 */
export interface ParsedTask {
  /** 从锚点提取的 ppf_id，null 表示新任务 */
  readonly ppf_id: string | null;
  /** 任务 ID（从 backtick 中提取） */
  readonly id: string;
  /** 任务标题 */
  readonly title: string;
  /** 任务状态（从 checkbox 推断） */
  readonly status: "pending" | "completed";
}

/** 解析出的模块 */
export interface ParsedModule {
  /** 从锚点提取的 ppf_id，null 表示新模块 */
  readonly ppf_id: string | null;
  /** 模块名称 */
  readonly module: string;
  /** 模块 slug */
  readonly slug: string;
  /** 模块状态 */
  readonly status: string;
  /** 模块优先级 */
  readonly priority: string;
  /** 依赖的模块 slug 列表 */
  readonly depends_on: readonly string[];
  /** 概述文本 */
  readonly overview: string;
  /** 解析出的任务列表 */
  readonly tasks: readonly ParsedTask[];
}

/** 解析结果 */
export interface ParseResult {
  /** 解析出的项目信息（部分字段） */
  readonly project: Partial<PPFProject>;
  /** 解析出的模块列表 */
  readonly modules: readonly ParsedModule[];
  /** 无法解析的内容片段 */
  readonly unmatchedContent: readonly string[];
  /** 找到的锚点总数 */
  readonly anchorsFound: number;
  /** 无锚点的新内容数量 */
  readonly newContentCount: number;
}

// ============================================================
// 锚点解析
// ============================================================

/** 锚点正则：<!-- ppf:type:id --> */
const ANCHOR_REGEX = /<!--\s*ppf:(\w+):([\w_-]+)\s*-->/;

/** 从 HTML 注释中提取锚点信息 */
function parseAnchor(
  html: string
): { type: string; id: string } | null {
  const match = ANCHOR_REGEX.exec(html);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

// ============================================================
// 元数据行解析
// ============================================================

/** 元数据行正则：**状态**: xxx | **优先级**: xxx | **依赖**: xxx */
const META_STATUS_REGEX = /\*\*状态\*\*:\s*(\S+)/;
const META_PRIORITY_REGEX = /\*\*优先级\*\*:\s*(\S+)/;
const META_DEPENDS_REGEX = /\*\*依赖\*\*:\s*(.+)/;

/** 从元数据行提取模块属性 */
function parseMetaLine(text: string): {
  status: string;
  priority: string;
  depends_on: readonly string[];
} {
  const statusMatch = META_STATUS_REGEX.exec(text);
  const priorityMatch = META_PRIORITY_REGEX.exec(text);
  const dependsMatch = META_DEPENDS_REGEX.exec(text);

  return {
    status: statusMatch?.[1] ?? "pending",
    priority: priorityMatch?.[1] ?? "medium",
    depends_on: dependsMatch
      ? dependsMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

// ============================================================
// 模块标题解析
// ============================================================

/** 模块标题正则：### 模块名 (`slug`) */
const MODULE_HEADING_REGEX = /^(.+?)\s*\(`([a-z0-9]+(?:-[a-z0-9]+)*)`\)$/;

/** 从 heading 文本中提取模块名和 slug */
function parseModuleHeading(
  text: string
): { module: string; slug: string } | null {
  const match = MODULE_HEADING_REGEX.exec(text.trim());
  if (!match) return null;
  return { module: match[1].trim(), slug: match[2] };
}

// ============================================================
// 任务列表项解析
// ============================================================

/** 从列表项文本中提取任务信息 */
function parseTaskItem(
  text: string,
  checked: boolean
): { id: string; title: string } | null {
  // 格式：`task-id` 任务标题 <!-- ppf:task:ppf_xxx -->
  // 先移除锚点注释
  const withoutAnchor = text.replace(ANCHOR_REGEX, "").trim();
  // 提取 backtick 中的 task id
  const idMatch = /^`([^`]+)`\s*(.*)$/.exec(withoutAnchor);
  if (!idMatch) return null;
  return { id: idMatch[1], title: idMatch[2].trim() };
}

// ============================================================
// AST 节点文本提取
// ============================================================

/** 递归提取 AST 节点的纯文本内容 */
function extractText(node: Content): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return (node.children as Content[]).map(extractText).join("");
  }
  return "";
}

/** 提取 heading 节点的文本 */
function headingText(node: Heading): string {
  return node.children.map(extractText).join("");
}

// ============================================================
// Frontmatter 解析
// ============================================================

/** 从 AST 中提取 frontmatter 数据 */
function extractFrontmatter(
  tree: Root
): Record<string, unknown> | null {
  const yamlNode = tree.children.find((n) => n.type === "yaml");
  if (!yamlNode || !("value" in yamlNode)) return null;

  try {
    const data = yaml.load(yamlNode.value as string);
    if (typeof data === "object" && data !== null) {
      return data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// 主解析逻辑
// ============================================================

/**
 * 解析 Markdown 文档为 PPF 结构
 *
 * 解析流程：
 * 1. 使用 unified + remark-parse 解析为 AST
 * 2. 提取 frontmatter（YAML）
 * 3. 遍历 AST 节点，识别 HTML 注释锚点
 * 4. 提取 heading 层级结构（# = 项目，### = 模块，#### 任务 = 任务列表）
 * 5. 解析 checkbox 列表项为任务
 * 6. 提取状态/优先级/依赖等元数据行
 *
 * @param markdown - Markdown 文本
 * @returns 解析结果
 */
export function parseMarkdownToPPF(markdown: string): ParseResult {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"]);

  const tree = processor.parse(markdown) as Root;

  // 提取 frontmatter
  const frontmatter = extractFrontmatter(tree);

  // 项目信息
  const project: Record<string, unknown> = {};
  if (frontmatter) {
    if (frontmatter.ppf_version) {
      project.schema_version = frontmatter.ppf_version as string;
    }
    if (frontmatter.ppf_project_id) {
      project.ppf_id = frontmatter.ppf_project_id as string;
    }
  }

  const modules: ParsedModule[] = [];
  const unmatchedContent: string[] = [];
  let anchorsFound = 0;
  let newContentCount = 0;

  // 状态机：遍历 AST 节点
  let currentModule: {
    ppf_id: string | null;
    module: string;
    slug: string;
    status: string;
    priority: string;
    depends_on: string[];
    overview: string;
    tasks: ParsedTask[];
    inTaskSection: boolean;
  } | null = null;

  const children = tree.children.filter((n) => n.type !== "yaml");

  for (let i = 0; i < children.length; i++) {
    const node = children[i];

    // HTML 注释（锚点）
    if (node.type === "html") {
      const anchorInfo = parseAnchor((node as Html).value);
      if (anchorInfo) {
        anchorsFound++;

        if (anchorInfo.type === "project") {
          project.ppf_id = anchorInfo.id;
        } else if (anchorInfo.type === "module" && currentModule) {
          currentModule.ppf_id = anchorInfo.id;
        }
        // task 锚点在列表项中处理
      }
      continue;
    }

    // Heading 节点
    if (node.type === "heading") {
      const heading = node as Heading;
      const text = headingText(heading);

      // # 项目标题
      if (heading.depth === 1) {
        project.name = text;
        continue;
      }

      // ### 模块标题
      if (heading.depth === 3) {
        // 保存上一个模块
        if (currentModule) {
          modules.push({
            ppf_id: currentModule.ppf_id,
            module: currentModule.module,
            slug: currentModule.slug,
            status: currentModule.status,
            priority: currentModule.priority,
            depends_on: currentModule.depends_on,
            overview: currentModule.overview,
            tasks: currentModule.tasks,
          });
        }

        const parsed = parseModuleHeading(text);
        if (parsed) {
          currentModule = {
            ppf_id: null,
            module: parsed.module,
            slug: parsed.slug,
            status: "pending",
            priority: "medium",
            depends_on: [],
            overview: "",
            tasks: [],
            inTaskSection: false,
          };
        } else {
          currentModule = null;
          unmatchedContent.push(`无法解析模块标题: ${text}`);
        }
        continue;
      }

      // #### 任务
      if (heading.depth === 4 && currentModule) {
        if (text === "任务") {
          currentModule.inTaskSection = true;
        } else {
          currentModule.inTaskSection = false;
        }
        continue;
      }

      continue;
    }

    // 段落节点（可能是元数据行、描述或概述）
    if (node.type === "paragraph" && currentModule) {
      const text = (node.children as Content[]).map(extractText).join("");

      // 检查是否是元数据行
      if (text.includes("**状态**:")) {
        const meta = parseMetaLine(text);
        currentModule.status = meta.status;
        currentModule.priority = meta.priority;
        currentModule.depends_on = [...meta.depends_on];
        continue;
      }

      // 非任务区域的段落作为概述
      if (!currentModule.inTaskSection) {
        currentModule.overview = currentModule.overview
          ? `${currentModule.overview}\n${text}`
          : text;
      }
      continue;
    }

    // blockquote（项目描述）
    if (node.type === "blockquote" && !currentModule) {
      const text = (node.children as Content[])
        .map(extractText)
        .join("")
        .trim();
      project.description = text;
      continue;
    }

    // 列表节点（任务列表或技术栈）
    if (node.type === "list") {
      // 在模块的任务区域内 -> 解析为任务
      if (currentModule?.inTaskSection) {
        for (const item of node.children) {
          if (item.type !== "listItem") continue;
          const listItem = item as ListItem;

          // 提取列表项文本
          const itemText = (listItem.children as Content[])
            .map(extractText)
            .join("");

          // 检查锚点
          let taskPpfId: string | null = null;
          const anchorInItem = ANCHOR_REGEX.exec(itemText);
          if (anchorInItem) {
            const anchorInfo = parseAnchor(anchorInItem[0]);
            if (anchorInfo?.type === "task") {
              taskPpfId = anchorInfo.id;
              anchorsFound++;
            }
          }

          const checked = listItem.checked === true;
          const parsed = parseTaskItem(itemText, checked);

          if (parsed) {
            const task: ParsedTask = {
              ppf_id: taskPpfId,
              id: parsed.id,
              title: parsed.title,
              status: checked ? "completed" : "pending",
            };
            currentModule.tasks.push(task);

            if (!taskPpfId) {
              newContentCount++;
            }
          } else {
            unmatchedContent.push(`无法解析任务项: ${itemText.trim()}`);
          }
        }
        continue;
      }

      // 不在模块内的列表（可能是技术栈）
      if (!currentModule) {
        const items: string[] = [];
        for (const item of node.children) {
          if (item.type !== "listItem") continue;
          const text = ((item as ListItem).children as Content[])
            .map(extractText)
            .join("")
            .trim();
          items.push(text);
        }
        // 检查前一个节点是否是 "## 技术栈"
        const prevNode = i > 0 ? children[i - 1] : null;
        if (
          prevNode?.type === "heading" &&
          (prevNode as Heading).depth === 2 &&
          headingText(prevNode as Heading) === "技术栈"
        ) {
          project.tech_stack = items;
        }
      }
      continue;
    }
  }

  // 保存最后一个模块
  if (currentModule) {
    modules.push({
      ppf_id: currentModule.ppf_id,
      module: currentModule.module,
      slug: currentModule.slug,
      status: currentModule.status,
      priority: currentModule.priority,
      depends_on: currentModule.depends_on,
      overview: currentModule.overview,
      tasks: currentModule.tasks,
    });
  }

  // 统计无锚点的新模块
  for (const mod of modules) {
    if (!mod.ppf_id) {
      newContentCount++;
    }
  }

  return {
    project: project as Partial<PPFProject>,
    modules,
    unmatchedContent,
    anchorsFound,
    newContentCount,
  };
}
