/**
 * 模块相关 Action 处理器
 *
 * 处理操作类型：
 * - module.create  创建模块
 * - module.update  更新模块
 * - module.delete  删除模块
 *
 * 包含依赖验证和循环检测。
 * 所有操作都是不可变的 —— 创建新的 state 对象，不修改传入的 state。
 * 适配新版 ActionHandler 函数签名：(action, state) => ActionResult
 */

import {
  generatePPFId,
  PPFModuleSchema,
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
 * 验证模块依赖是否存在
 * @param modules - 所有模块
 * @param dependsOn - 依赖列表
 * @returns 不存在的依赖 slug 列表
 */
function validateDependencies(
  modules: readonly PPFModule[],
  dependsOn: readonly string[]
): string[] {
  const slugs = new Set(modules.map((m) => m.slug));
  return dependsOn.filter((dep) => !slugs.has(dep));
}

/**
 * 检测循环依赖（拓扑排序 - Kahn 算法）
 * @param modules - 所有模块
 * @returns 存在循环的模块 slug 列表，无循环时返回 null
 */
function detectCycles(modules: readonly PPFModule[]): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const mod of modules) {
    inDegree.set(mod.slug, 0);
    adjacency.set(mod.slug, []);
  }

  const slugSet = new Set(modules.map((m) => m.slug));
  for (const mod of modules) {
    for (const dep of mod.depends_on) {
      if (slugSet.has(dep)) {
        adjacency.get(dep)!.push(mod.slug);
        inDegree.set(mod.slug, (inDegree.get(mod.slug) ?? 0) + 1);
      }
    }
  }

  let queue = modules
    .filter((m) => inDegree.get(m.slug) === 0)
    .map((m) => m.slug);
  const sorted: string[] = [];

  while (queue.length > 0) {
    sorted.push(...queue);
    const next: string[] = [];
    for (const node of queue) {
      for (const neighbor of adjacency.get(node) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) next.push(neighbor);
      }
    }
    queue = next;
  }

  if (sorted.length === modules.length) return null;
  const sortedSet = new Set(sorted);
  return modules.filter((m) => !sortedSet.has(m.slug)).map((m) => m.slug);
}

/**
 * 构建成功的 ActionResult
 */
function successResult(
  action: Action,
  before: unknown,
  after: unknown
): ActionResult {
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

/** module.create 处理器 */
export const moduleCreateHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "module.create") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const { data } = payload;

  try {
    const slug = data.slug as string;
    if (!slug) {
      return errorResult(action, state, "模块 slug 不能为空");
    }

    // 检查 slug 唯一性
    if (project.modules.some((m) => m.slug === slug)) {
      return errorResult(action, state, `模块 slug "${slug}" 已存在`);
    }

    const now = new Date().toISOString();

    const newModule: PPFModule = PPFModuleSchema.parse({
      module: (data.module as string) ?? slug,
      slug,
      layer: (data.layer as string) ?? "implementation",
      status: "pending",
      depends_on: (data.depends_on as string[]) ?? [],
      decision_refs: (data.decision_refs as number[]) ?? [],
      overview: (data.overview as string) ?? "",
      priority: (data.priority as string) ?? "medium",
      estimated_hours: (data.estimated_hours as number) ?? null,
      created_at: now,
      updated_at: now,
      tasks: [],
      ppf_id: generatePPFId(),
      extensions: {},
      tags: (data.tags as string[]) ?? [],
      source: (data.source as string) ?? "",
    });

    const updatedModules = [...project.modules, newModule];

    // 验证依赖
    const missingDeps = validateDependencies(
      updatedModules,
      newModule.depends_on
    );
    if (missingDeps.length > 0) {
      return errorResult(
        action,
        state,
        `模块 "${slug}" 依赖的模块不存在: ${missingDeps.join(", ")}`
      );
    }

    // 检测循环依赖
    const cycles = detectCycles(updatedModules);
    if (cycles) {
      return errorResult(
        action,
        state,
        `检测到循环依赖: ${cycles.join(", ")}`
      );
    }

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

/** module.update 处理器 */
export const moduleUpdateHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "module.update") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const { changes } = payload;
  const targetId = action.target_id;

  try {
    const modIndex = project.modules.findIndex((m) => m.ppf_id === targetId);
    if (modIndex === -1) {
      return errorResult(
        action,
        state,
        `未找到 ppf_id 为 "${targetId}" 的模块`
      );
    }

    const mod = project.modules[modIndex];
    const now = new Date().toISOString();

    const updatedModule: PPFModule = {
      ...mod,
      ...(changes.module !== undefined && { module: changes.module as string }),
      ...(changes.layer !== undefined && {
        layer: changes.layer as "feature" | "implementation",
      }),
      ...(changes.status !== undefined && {
        status: changes.status as PPFModule["status"],
      }),
      ...(changes.overview !== undefined && {
        overview: changes.overview as string,
      }),
      ...(changes.priority !== undefined && {
        priority: changes.priority as PPFModule["priority"],
      }),
      ...(changes.estimated_hours !== undefined && {
        estimated_hours: changes.estimated_hours as number | null,
      }),
      ...(changes.depends_on !== undefined && {
        depends_on: changes.depends_on as string[],
      }),
      ...(changes.decision_refs !== undefined && {
        decision_refs: changes.decision_refs as number[],
      }),
      ...(changes.tags !== undefined && { tags: changes.tags as string[] }),
      ...(changes.source !== undefined && {
        source: changes.source as string,
      }),
      updated_at: now,
    };

    const updatedModules = project.modules.map((m, i) =>
      i === modIndex ? updatedModule : m
    );

    // 如果依赖发生变化，重新验证
    if (changes.depends_on !== undefined) {
      const missingDeps = validateDependencies(
        updatedModules,
        updatedModule.depends_on
      );
      if (missingDeps.length > 0) {
        return errorResult(
          action,
          state,
          `模块 "${mod.slug}" 依赖的模块不存在: ${missingDeps.join(", ")}`
        );
      }

      const cycles = detectCycles(updatedModules);
      if (cycles) {
        return errorResult(
          action,
          state,
          `检测到循环依赖: ${cycles.join(", ")}`
        );
      }
    }

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

/** module.delete 处理器 */
export const moduleDeleteHandler: ActionHandler = (
  action: Action,
  state: unknown
): ActionResult => {
  const project = state as PPFProject;
  const payload = action.payload;

  if (payload.type !== "module.delete") {
    return errorResult(action, state, "载荷类型不匹配");
  }

  const targetId = action.target_id;

  try {
    const modIndex = project.modules.findIndex((m) => m.ppf_id === targetId);
    if (modIndex === -1) {
      return errorResult(
        action,
        state,
        `未找到 ppf_id 为 "${targetId}" 的模块`
      );
    }

    const mod = project.modules[modIndex];

    // 检查是否有其他模块依赖此模块
    const dependents = project.modules.filter(
      (m) => m.slug !== mod.slug && m.depends_on.includes(mod.slug)
    );
    if (dependents.length > 0) {
      const names = dependents.map((m) => m.slug).join(", ");
      return errorResult(
        action,
        state,
        `无法删除模块 "${mod.slug}"，以下模块依赖它: ${names}`
      );
    }

    // 检查是否有阶段引用此模块（如果 project 有 phases 字段）
    const phases = (project as Record<string, unknown>).phases;
    if (Array.isArray(phases)) {
      const referencingPhases = phases.filter(
        (p: Record<string, unknown>) =>
          Array.isArray(p.modules) && p.modules.includes(mod.slug)
      );
      if (referencingPhases.length > 0) {
        const names = referencingPhases
          .map((p: Record<string, unknown>) => p.slug as string)
          .join(", ");
        return errorResult(
          action,
          state,
          `无法删除模块 "${mod.slug}"，以下阶段引用它: ${names}`
        );
      }
    }

    const newState: PPFProject = {
      ...project,
      modules: project.modules.filter((m) => m.ppf_id !== targetId),
      updated_at: new Date().toISOString(),
    };

    return successResult(action, state, newState);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    return errorResult(action, state, msg);
  }
};
