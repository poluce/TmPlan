/**
 * 任务相关 Action 处理器
 *
 * 处理操作类型：
 * - task.create  创建任务
 * - task.update  更新任务
 * - task.delete  删除任务
 * - task.move    移动任务（跨模块或调整顺序）
 *
 * 所有操作都是不可变的 —— 创建新的 state 对象，不修改传入的 state。
 * 适配新版 ActionHandler 函数签名：(action, state) => ActionResult
 */

import {
  generatePPFId,
  PPFTaskSchema,
  type PPFTask,
  type PPFModule,
  type PPFProject,
} from "@/types/ppf";
import { generateEventId } from "@/types/event-sourcing";
import type {
  Action,
  ActionHandler,
  ActionResult,
} from "@/types/action-protocol";
import { generatePatches } from "../action-dispatcher";

/**
 * 在项目状态中查找模块索引
 * @param modules - 模块列表
 * @param moduleSlug - 模块 slug
 * @returns 模块索引，未找到时抛出错误
 */
function findModuleIndex(
  modules: readonly PPFModule[],
  moduleSlug: string
): number {
  const index = modules.findIndex((m) => m.slug === moduleSlug);
  if (index === -1) {
    throw new Error(`模块 "${moduleSlug}" 不存在`);
  }
  return index;
}

/**
 * 在模块中查找任务索引
 * @param mod - 模块
 * @param taskId - 任务 ID
 * @returns 任务索引，未找到时抛出错误
 */
function findTaskIndex(mod: PPFModule, taskId: string): number {
  const index = mod.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    throw new Error(`任务 "${taskId}" 在模块 "${mod.slug}" 中不存在`);
  }
  return index;
}

/**
 * 替换模块数组中指定索引的模块（不可变）
 */
function replaceModule(
  modules: PPFModule[],
  index: number,
  newModule: PPFModule
): PPFModule[] {
  return modules.map((m, i) => (i === index ? newModule : m));
}

/**
 * 构建成功的 ActionResult
 */
function successResult(
  action: Action,
  before: unknown,
  after: unknown
): ActionResult {
  const patches = generatePatches(before, after);
  return {
    success: true,
    action_id: action.id,
    snapshot_before: before,
    snapshot_after: after,
    events: [
      {
        event_id: generateEventId(),
        type: action.type,
      },
    ],
    errors: [],
  };
}

/**
 * 构建失败的 ActionResult
 */
function errorResult(
  action: Action,
  state: unknown,
  message: string
): ActionResult {
  return {
    success: false,
    action_id: action.id,
    snapshot_before: state,
    snapshot_after: state,
    events: [],
    errors: [message],
  };
}

/** task.create 处理器 */
export const taskCreateHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "task.create") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const { module_slug, data } = payload;

  try {
    const modules = [...project.modules] as PPFModule[];
    const modIndex = findModuleIndex(modules, module_slug);
    const mod = modules[modIndex];

    // 生成任务 ID：slug-序号
    const nextNum = mod.tasks.length + 1;
    const taskId =
      (data.id as string) ??
      `${module_slug}-${String(nextNum).padStart(2, "0")}`;

    const newTask: PPFTask = PPFTaskSchema.parse({
      id: taskId,
      title: (data.title as string) ?? "",
      status: (data.status as string) ?? "pending",
      depends_on: (data.depends_on as string[]) ?? [],
      detail: (data.detail as string) ?? "",
      files_to_create: (data.files_to_create as string[]) ?? [],
      files_to_modify: (data.files_to_modify as string[]) ?? [],
      acceptance_criteria: (data.acceptance_criteria as string[]) ?? [],
      ppf_id: generatePPFId(),
      extensions: {},
      assignee: (data.assignee as string) ?? "",
      tags: (data.tags as string[]) ?? [],
      due_date: (data.due_date as string) ?? null,
    });

    const now = new Date().toISOString();
    const updatedModule: PPFModule = {
      ...mod,
      tasks: [...mod.tasks, newTask],
      updated_at: now,
    };

    const updatedModules = replaceModule(modules, modIndex, updatedModule);
    const newState: PPFProject = {
      ...project,
      modules: updatedModules,
      updated_at: now,
    };

    return successResult(action, state, newState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return errorResult(action, state, msg);
  }
};

/** task.update 处理器 */
export const taskUpdateHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "task.update") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const { changes } = payload;
  // target_id 指向任务的 ppf_id，需要在所有模块中查找
  const targetId = action.target_id;

  try {
    const modules = [...project.modules] as PPFModule[];
    let found = false;
    let updatedModules = modules;

    for (let mi = 0; mi < modules.length; mi++) {
      const mod = modules[mi];
      const taskIndex = mod.tasks.findIndex((t) => t.ppf_id === targetId);
      if (taskIndex === -1) continue;

      found = true;
      const task = mod.tasks[taskIndex];
      const now = new Date().toISOString();

      const updatedTask: PPFTask = {
        ...task,
        ...(changes.title !== undefined && { title: changes.title as string }),
        ...(changes.status !== undefined && {
          status: changes.status as PPFTask["status"],
        }),
        ...(changes.detail !== undefined && {
          detail: changes.detail as string,
        }),
        ...(changes.depends_on !== undefined && {
          depends_on: changes.depends_on as string[],
        }),
        ...(changes.files_to_create !== undefined && {
          files_to_create: changes.files_to_create as string[],
        }),
        ...(changes.files_to_modify !== undefined && {
          files_to_modify: changes.files_to_modify as string[],
        }),
        ...(changes.acceptance_criteria !== undefined && {
          acceptance_criteria: changes.acceptance_criteria as string[],
        }),
        ...(changes.assignee !== undefined && {
          assignee: changes.assignee as string,
        }),
        ...(changes.tags !== undefined && { tags: changes.tags as string[] }),
        ...(changes.due_date !== undefined && {
          due_date: changes.due_date as string | null,
        }),
      };

      const updatedTasks = mod.tasks.map((t, i) =>
        i === taskIndex ? updatedTask : t
      );
      const updatedModule: PPFModule = {
        ...mod,
        tasks: updatedTasks,
        updated_at: now,
      };
      updatedModules = replaceModule(modules, mi, updatedModule);
      break;
    }

    if (!found) {
      return errorResult(action, state, `未找到 ppf_id 为 "${targetId}" 的任务`);
    }

    const newState: PPFProject = {
      ...project,
      modules: updatedModules,
      updated_at: new Date().toISOString(),
    };

    return successResult(action, state, newState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return errorResult(action, state, msg);
  }
};

/** task.delete 处理器 */
export const taskDeleteHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "task.delete") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const targetId = action.target_id;
  const { cascade } = payload;

  try {
    const modules = [...project.modules] as PPFModule[];
    let found = false;
    let updatedModules = modules;

    for (let mi = 0; mi < modules.length; mi++) {
      const mod = modules[mi];
      const taskIndex = mod.tasks.findIndex((t) => t.ppf_id === targetId);
      if (taskIndex === -1) continue;

      found = true;
      const task = mod.tasks[taskIndex];

      // 检查是否有其他任务依赖此任务
      const dependents = mod.tasks.filter(
        (t) => t.id !== task.id && t.depends_on.includes(task.id)
      );

      let newTasks: PPFTask[];
      if (dependents.length > 0 && !cascade) {
        const names = dependents.map((t) => t.id).join(", ");
        return errorResult(
          action,
          state,
          `无法删除任务 "${task.id}"，以下任务依赖它: ${names}。设置 cascade=true 可级联删除。`
        );
      }

      if (cascade && dependents.length > 0) {
        // 级联删除：移除目标任务及所有依赖它的任务
        const toRemove = new Set([task.id, ...dependents.map((t) => t.id)]);
        newTasks = mod.tasks.filter((t) => !toRemove.has(t.id));
      } else {
        newTasks = mod.tasks.filter((t) => t.ppf_id !== targetId);
      }

      const updatedModule: PPFModule = {
        ...mod,
        tasks: newTasks,
        updated_at: new Date().toISOString(),
      };
      updatedModules = replaceModule(modules, mi, updatedModule);
      break;
    }

    if (!found) {
      return errorResult(action, state, `未找到 ppf_id 为 "${targetId}" 的任务`);
    }

    const newState: PPFProject = {
      ...project,
      modules: updatedModules,
      updated_at: new Date().toISOString(),
    };

    return successResult(action, state, newState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return errorResult(action, state, msg);
  }
};

/** task.move 处理器 */
export const taskMoveHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "task.move") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const { from_module, to_module, position } = payload;
  const targetId = action.target_id;

  try {
    const modules = [...project.modules] as PPFModule[];
    const srcModIndex = findModuleIndex(modules, from_module);
    const srcMod = modules[srcModIndex];

    const taskIndex = srcMod.tasks.findIndex((t) => t.ppf_id === targetId);
    if (taskIndex === -1) {
      return errorResult(
        action,
        state,
        `任务 ppf_id "${targetId}" 在模块 "${from_module}" 中不存在`
      );
    }

    const task = srcMod.tasks[taskIndex];
    const now = new Date().toISOString();

    // 同模块内移动（调整顺序）
    if (from_module === to_module) {
      const tasks = [...srcMod.tasks];
      tasks.splice(taskIndex, 1);
      const insertAt =
        position !== undefined
          ? Math.min(position, tasks.length)
          : tasks.length;
      tasks.splice(insertAt, 0, task);

      const updatedModule: PPFModule = {
        ...srcMod,
        tasks,
        updated_at: now,
      };

      const newState: PPFProject = {
        ...project,
        modules: replaceModule(modules, srcModIndex, updatedModule),
        updated_at: now,
      };

      return successResult(action, state, newState);
    }

    // 跨模块移动
    const tgtModIndex = findModuleIndex(modules, to_module);
    const tgtMod = modules[tgtModIndex];

    const updatedSrcModule: PPFModule = {
      ...srcMod,
      tasks: srcMod.tasks.filter((t) => t.ppf_id !== targetId),
      updated_at: now,
    };

    const targetTasks = [...tgtMod.tasks];
    const insertAt =
      position !== undefined
        ? Math.min(position, targetTasks.length)
        : targetTasks.length;
    targetTasks.splice(insertAt, 0, task);

    const updatedTgtModule: PPFModule = {
      ...tgtMod,
      tasks: targetTasks,
      updated_at: now,
    };

    let updatedModules = replaceModule(modules, srcModIndex, updatedSrcModule);
    updatedModules = replaceModule(updatedModules, tgtModIndex, updatedTgtModule);

    const newState: PPFProject = {
      ...project,
      modules: updatedModules,
      updated_at: now,
    };

    return successResult(action, state, newState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return errorResult(action, state, msg);
  }
};
