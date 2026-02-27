/**
 * Markdown 双向同步编排器
 *
 * 编排 Markdown 导入/导出的双向同步流程：
 * 1. 解析 Markdown 得到 parsed 结构
 * 2. 与当前 PPF 状态对比
 * 3. 生成 create / update Action
 * 4. 检测可能的删除（标记为冲突，不自动删除）
 * 5. 通过 ActionDispatcher 执行所有 Action
 */

import { readFile } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";
import { parseMarkdownToPPF, type ParsedModule } from "./markdown-parser";
import type { ActionDispatcher } from "./action-dispatcher";
import {
  generatePPFId,
  type PPFProject,
  type PPFModule,
} from "@/types/ppf";
import {
  generateActionId,
  type Action,
  type ActionContext,
} from "@/types/action-protocol";

// ============================================================
// 同步结果类型
// ============================================================

/** 同步冲突 */
export interface SyncConflict {
  /** 冲突实体的 ppf_id */
  readonly ppf_id: string;
  /** 冲突字段名 */
  readonly field: string;
  /** 当前值 */
  readonly currentValue: unknown;
  /** 传入值 */
  readonly incomingValue: unknown;
  /** 冲突解决策略 */
  readonly resolution: "keep_current" | "use_incoming" | "manual";
}

/** 同步结果 */
export interface SyncResult {
  /** 新创建的实体 ppf_id 列表 */
  readonly created: readonly string[];
  /** 更新的实体 ppf_id 列表 */
  readonly updated: readonly string[];
  /** 可能被删除的实体 ppf_id 列表（不自动删除） */
  readonly deleted: readonly string[];
  /** 同步冲突列表 */
  readonly conflicts: readonly SyncConflict[];
  /** 生成的所有 Action */
  readonly actions: readonly Action[];
}

// ============================================================
// 内部辅助函数
// ============================================================

const TMPLAN_DIR = ".tmplan";

/**
 * 读取当前 PPF 项目状态
 * @param basePath - 项目根目录
 * @returns 项目配置和模块列表
 */
async function readCurrentState(
  basePath: string
): Promise<{ project: PPFProject; modules: PPFModule[] } | null> {
  try {
    const projectPath = join(basePath, TMPLAN_DIR, "project.yaml");
    const projectContent = await readFile(projectPath, "utf-8");
    const project = yaml.load(projectContent) as PPFProject;

    // 读取模块列表（从 project.modules 或独立文件）
    const modules: PPFModule[] = Array.isArray(
      (project as Record<string, unknown>).modules
    )
      ? ((project as Record<string, unknown>).modules as PPFModule[])
      : [];

    return { project, modules };
  } catch {
    return null;
  }
}

/**
 * 创建 Action 上下文
 */
function createContext(): ActionContext {
  return {
    source: "markdown",
    actor: "markdown-sync",
    timestamp: new Date().toISOString(),
    correlation_id: `cor_sync_${Date.now()}`,
    metadata: {},
  };
}

/**
 * 对比两个值是否相等（深度比较）
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 对比模块字段差异，生成冲突和更新 Action
 */
function diffModule(
  current: PPFModule,
  incoming: ParsedModule
): { changes: Record<string, unknown>; conflicts: SyncConflict[] } {
  const changes: Record<string, unknown> = {};
  const conflicts: SyncConflict[] = [];

  // 对比可更新字段
  const fieldsToCompare: Array<{
    field: string;
    currentVal: unknown;
    incomingVal: unknown;
  }> = [
    { field: "module", currentVal: current.module, incomingVal: incoming.module },
    { field: "status", currentVal: current.status, incomingVal: incoming.status },
    {
      field: "priority",
      currentVal: current.priority,
      incomingVal: incoming.priority,
    },
    {
      field: "overview",
      currentVal: current.overview,
      incomingVal: incoming.overview,
    },
    {
      field: "depends_on",
      currentVal: current.depends_on,
      incomingVal: incoming.depends_on,
    },
  ];

  for (const { field, currentVal, incomingVal } of fieldsToCompare) {
    if (!deepEqual(currentVal, incomingVal)) {
      changes[field] = incomingVal;
    }
  }

  return { changes, conflicts };
}

/**
 * 对比任务状态差异
 */
function diffTasks(
  currentModule: PPFModule,
  incomingModule: ParsedModule
): {
  taskActions: Action[];
  taskConflicts: SyncConflict[];
  createdTaskIds: string[];
  updatedTaskIds: string[];
} {
  const taskActions: Action[] = [];
  const taskConflicts: SyncConflict[] = [];
  const createdTaskIds: string[] = [];
  const updatedTaskIds: string[] = [];
  const context = createContext();

  for (const incomingTask of incomingModule.tasks) {
    if (incomingTask.ppf_id) {
      // 有锚点 -> 查找现有任务并对比
      const existingTask = currentModule.tasks.find(
        (t) => t.ppf_id === incomingTask.ppf_id
      );

      if (existingTask) {
        const taskChanges: Record<string, unknown> = {};

        if (existingTask.title !== incomingTask.title) {
          taskChanges.title = incomingTask.title;
        }
        if (existingTask.status !== incomingTask.status) {
          taskChanges.status = incomingTask.status;
        }

        if (Object.keys(taskChanges).length > 0) {
          const action: Action = {
            id: generateActionId(),
            type: "task.update",
            target_id: incomingTask.ppf_id,
            payload: { type: "task.update", changes: taskChanges },
            context,
          };
          taskActions.push(action);
          updatedTaskIds.push(incomingTask.ppf_id);
        }
      }
    } else {
      // 无锚点 -> 新任务
      const newPpfId = generatePPFId();
      const action: Action = {
        id: generateActionId(),
        type: "task.create",
        target_id: newPpfId,
        payload: {
          type: "task.create",
          module_slug: incomingModule.slug,
          data: {
            id: incomingTask.id,
            title: incomingTask.title,
            status: incomingTask.status,
          },
        },
        context,
      };
      taskActions.push(action);
      createdTaskIds.push(newPpfId);
    }
  }

  // 检测可能被删除的任务（现有任务在 incoming 中不存在）
  const incomingPpfIds = new Set(
    incomingModule.tasks
      .filter((t) => t.ppf_id !== null)
      .map((t) => t.ppf_id as string)
  );

  for (const existingTask of currentModule.tasks) {
    if (!incomingPpfIds.has(existingTask.ppf_id)) {
      taskConflicts.push({
        ppf_id: existingTask.ppf_id,
        field: "_existence",
        currentValue: existingTask.title,
        incomingValue: null,
        resolution: "manual",
      });
    }
  }

  return { taskActions, taskConflicts, createdTaskIds, updatedTaskIds };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 从 Markdown 同步到 PPF 状态
 *
 * 同步算法：
 * 1. parseMarkdownToPPF(markdown) 得到 parsed
 * 2. 读取当前 PPF 状态
 * 3. 锚点匹配：parsed 中有 ppf_id 的 -> 与现有实体对比
 * 4. 新内容：parsed 中无 ppf_id 的 -> 生成 create Action
 * 5. 删除检测：现有实体在 parsed 中不存在 -> 标记为可能删除（不自动删除，加入 conflicts）
 * 6. 字段 diff：匹配到的实体逐字段对比，有差异 -> 生成 update Action
 * 7. 通过 dispatcher 执行所有 Action
 *
 * @param basePath - 项目根目录
 * @param markdown - Markdown 文本
 * @param dispatcher - Action 分发器
 * @returns 同步结果
 */
export async function syncFromMarkdown(
  basePath: string,
  markdown: string,
  dispatcher: ActionDispatcher
): Promise<SyncResult> {
  // 1. 解析 Markdown
  const parsed = parseMarkdownToPPF(markdown);

  // 2. 读取当前状态
  const currentState = await readCurrentState(basePath);

  const allActions: Action[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const conflicts: SyncConflict[] = [];
  const context = createContext();

  // 如果没有现有状态，所有内容都是新建
  if (!currentState) {
    for (const mod of parsed.modules) {
      const newPpfId = mod.ppf_id ?? generatePPFId();
      const action: Action = {
        id: generateActionId(),
        type: "module.create",
        target_id: newPpfId,
        payload: {
          type: "module.create",
          data: {
            module: mod.module,
            slug: mod.slug,
            status: mod.status,
            priority: mod.priority,
            depends_on: [...mod.depends_on],
            overview: mod.overview,
          },
        },
        context,
      };
      allActions.push(action);
      created.push(newPpfId);

      // 创建模块下的任务
      for (const task of mod.tasks) {
        const taskPpfId = task.ppf_id ?? generatePPFId();
        const taskAction: Action = {
          id: generateActionId(),
          type: "task.create",
          target_id: taskPpfId,
          payload: {
            type: "task.create",
            module_slug: mod.slug,
            data: {
              id: task.id,
              title: task.title,
              status: task.status,
            },
          },
          context,
        };
        allActions.push(taskAction);
        created.push(taskPpfId);
      }
    }
  } else {
    // 3-6. 有现有状态，执行 diff
    const currentModuleMap = new Map<string, PPFModule>();
    for (const mod of currentState.modules) {
      currentModuleMap.set(mod.ppf_id, mod);
      currentModuleMap.set(mod.slug, mod);
    }

    const matchedPpfIds = new Set<string>();

    for (const incomingMod of parsed.modules) {
      // 尝试通过 ppf_id 或 slug 匹配
      const currentMod = incomingMod.ppf_id
        ? currentModuleMap.get(incomingMod.ppf_id)
        : currentModuleMap.get(incomingMod.slug);

      if (currentMod) {
        // 匹配到 -> diff
        matchedPpfIds.add(currentMod.ppf_id);

        const { changes } = diffModule(currentMod, incomingMod);

        if (Object.keys(changes).length > 0) {
          const action: Action = {
            id: generateActionId(),
            type: "module.update",
            target_id: currentMod.ppf_id,
            payload: { type: "module.update", changes },
            context,
          };
          allActions.push(action);
          updated.push(currentMod.ppf_id);
        }

        // diff 任务
        const taskDiff = diffTasks(currentMod, incomingMod);
        allActions.push(...taskDiff.taskActions);
        created.push(...taskDiff.createdTaskIds);
        updated.push(...taskDiff.updatedTaskIds);
        conflicts.push(...taskDiff.taskConflicts);
      } else {
        // 未匹配 -> 新模块
        const newPpfId = incomingMod.ppf_id ?? generatePPFId();
        const action: Action = {
          id: generateActionId(),
          type: "module.create",
          target_id: newPpfId,
          payload: {
            type: "module.create",
            data: {
              module: incomingMod.module,
              slug: incomingMod.slug,
              status: incomingMod.status,
              priority: incomingMod.priority,
              depends_on: [...incomingMod.depends_on],
              overview: incomingMod.overview,
            },
          },
          context,
        };
        allActions.push(action);
        created.push(newPpfId);

        // 创建新模块下的任务
        for (const task of incomingMod.tasks) {
          const taskPpfId = task.ppf_id ?? generatePPFId();
          const taskAction: Action = {
            id: generateActionId(),
            type: "task.create",
            target_id: taskPpfId,
            payload: {
              type: "task.create",
              module_slug: incomingMod.slug,
              data: {
                id: task.id,
                title: task.title,
                status: task.status,
              },
            },
            context,
          };
          allActions.push(taskAction);
          created.push(taskPpfId);
        }
      }
    }

    // 5. 删除检测：现有模块在 parsed 中不存在
    for (const currentMod of currentState.modules) {
      if (!matchedPpfIds.has(currentMod.ppf_id)) {
        deleted.push(currentMod.ppf_id);
        conflicts.push({
          ppf_id: currentMod.ppf_id,
          field: "_existence",
          currentValue: currentMod.module,
          incomingValue: null,
          resolution: "manual",
        });
      }
    }
  }

  // 7. 通过 dispatcher 执行所有 Action
  for (const action of allActions) {
    const state = currentState
      ? currentState.project
      : parsed.project;
    await dispatcher.dispatch(action, state);
  }

  return {
    created,
    updated,
    deleted,
    conflicts,
    actions: allActions,
  };
}
