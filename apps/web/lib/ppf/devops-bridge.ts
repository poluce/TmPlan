/**
 * DevOps 集成桥接器
 *
 * 处理来自 GitHub 等 DevOps 平台的 Webhook 事件，
 * 将其关联到 PPF 任务并生成对应的 Action。
 *
 * 关联策略：
 * 1. Branch 名匹配：从分支名提取 ppf_id（如 feat/ppf_V1StGXR8_Z5j-user-auth）
 * 2. Commit message 标记：匹配 [ppf:ppf_xxx] 模式
 * 3. PR title/body 标记：同上
 */

import {
  generateActionId,
  type Action,
  type ActionContext,
} from "@/types/action-protocol";
import type { ActionDispatcher } from "./action-dispatcher";

// ============================================================
// Webhook 事件类型（GitHub webhook payload 子集）
// ============================================================

/** Pull Request 信息 */
export interface WebhookPullRequest {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly html_url: string;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly merged: boolean;
  readonly state: "open" | "closed";
}

/** Commit 信息 */
export interface WebhookCommit {
  readonly sha: string;
  readonly message: string;
}

/** Push 事件 */
export interface WebhookPushEvent {
  readonly type: "push";
  readonly ref: string;
  readonly commits: readonly WebhookCommit[];
}

/** Pull Request 事件 */
export interface WebhookPREvent {
  readonly type: "pull_request";
  readonly action: "opened" | "closed" | "merged" | "synchronize";
  readonly pull_request: WebhookPullRequest;
}

/** Webhook 事件联合类型 */
export type WebhookEvent = WebhookPushEvent | WebhookPREvent;

// ============================================================
// 桥接结果类型
// ============================================================

/** 桥接处理结果 */
export interface BridgeResult {
  /** 匹配到的任务及其触发的操作 */
  readonly matched_tasks: readonly {
    readonly ppf_id: string;
    readonly action: string;
  }[];
  /** 未匹配到任务的标记 */
  readonly unmatched: readonly string[];
  /** 已分发的 Action ID 列表 */
  readonly actions_dispatched: readonly string[];
}

// ============================================================
// PPF ID 提取
// ============================================================

/** 从分支名提取 ppf_id：feat/ppf_V1StGXR8_Z5j-user-auth -> ppf_V1StGXR8_Z5j */
const BRANCH_PPF_REGEX = /(?:^|\/)(ppf_[A-Za-z0-9_-]{12})/;

/** 从文本中提取 [ppf:ppf_xxx] 标记 */
const TAG_PPF_REGEX = /\[ppf:(ppf_[A-Za-z0-9_-]{12})\]/g;

/**
 * 从分支名中提取 ppf_id
 * @param branchRef - 分支引用（如 refs/heads/feat/ppf_xxx-desc 或 feat/ppf_xxx-desc）
 */
function extractPpfIdFromBranch(branchRef: string): string | null {
  // 移除 refs/heads/ 前缀
  const branch = branchRef.replace(/^refs\/heads\//, "");
  const match = BRANCH_PPF_REGEX.exec(branch);
  return match ? match[1] : null;
}

/**
 * 从文本中提取所有 ppf_id 标记
 * @param text - 文本内容（commit message / PR title / PR body）
 */
function extractPpfIdsFromText(text: string): readonly string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  // 重置 lastIndex
  TAG_PPF_REGEX.lastIndex = 0;
  while ((match = TAG_PPF_REGEX.exec(text)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }

  return ids;
}

/**
 * 从多个来源收集所有关联的 ppf_id（去重）
 */
function collectPpfIds(sources: readonly (string | null)[]): readonly string[] {
  const ids = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    // 尝试分支名提取
    const branchId = extractPpfIdFromBranch(source);
    if (branchId) ids.add(branchId);
    // 尝试标记提取
    for (const id of extractPpfIdsFromText(source)) {
      ids.add(id);
    }
  }
  return [...ids];
}

// ============================================================
// Action 上下文
// ============================================================

/** 创建 webhook 来源的 Action 上下文 */
function createWebhookContext(): ActionContext {
  return {
    source: "webhook",
    actor: "devops-bridge",
    timestamp: new Date().toISOString(),
    correlation_id: `cor_webhook_${Date.now()}`,
    metadata: {},
  };
}

// ============================================================
// 事件处理器
// ============================================================

/**
 * 处理 Push 事件
 *
 * 从分支名和 commit message 中提取 ppf_id，
 * 更新关联任务的 extensions["agile-dev"].branch 字段。
 */
function handlePushEvent(event: WebhookPushEvent): {
  ppfIds: readonly string[];
  actions: Action[];
} {
  const sources: string[] = [event.ref];
  for (const commit of event.commits) {
    sources.push(commit.message);
  }

  const ppfIds = collectPpfIds(sources);
  const branch = event.ref.replace(/^refs\/heads\//, "");
  const context = createWebhookContext();

  const actions: Action[] = ppfIds.map((ppfId) => ({
    id: generateActionId(),
    type: "task.update" as const,
    target_id: ppfId,
    payload: {
      type: "task.update" as const,
      changes: {
        extensions: {
          "agile-dev": { branch },
        },
      },
    },
    context,
  }));

  return { ppfIds, actions };
}

/**
 * 处理 Pull Request 事件
 *
 * - opened: 关联任务，更新 pr_url
 * - merged/closed(merged=true): 标记任务为 completed
 */
function handlePREvent(event: WebhookPREvent): {
  ppfIds: readonly string[];
  actions: Action[];
} {
  const pr = event.pull_request;
  const sources: string[] = [
    pr.head.ref,
    pr.title,
    pr.body ?? "",
  ];

  const ppfIds = collectPpfIds(sources);
  const context = createWebhookContext();
  const actions: Action[] = [];

  if (event.action === "opened" || event.action === "synchronize") {
    // PR 打开或更新 -> 更新 pr_url
    for (const ppfId of ppfIds) {
      actions.push({
        id: generateActionId(),
        type: "task.update",
        target_id: ppfId,
        payload: {
          type: "task.update",
          changes: {
            extensions: {
              "agile-dev": { pr_url: pr.html_url },
            },
          },
        },
        context,
      });
    }
  }

  if (
    event.action === "closed" &&
    pr.merged
  ) {
    // PR 合并 -> 标记任务完成
    for (const ppfId of ppfIds) {
      actions.push({
        id: generateActionId(),
        type: "task.update",
        target_id: ppfId,
        payload: {
          type: "task.update",
          changes: {
            status: "completed",
          },
        },
        context,
      });
    }
  }

  // 处理 merged action（某些 webhook 直接发 merged）
  if (event.action === "merged") {
    for (const ppfId of ppfIds) {
      actions.push({
        id: generateActionId(),
        type: "task.update",
        target_id: ppfId,
        payload: {
          type: "task.update",
          changes: {
            status: "completed",
          },
        },
        context,
      });
    }
  }

  return { ppfIds, actions };
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 处理 GitHub Webhook 事件
 *
 * 从事件中提取 ppf_id 关联，生成对应的 Action 并通过 dispatcher 执行。
 *
 * 支持的事件：
 * - push: 更新任务的 branch 字段
 * - pull_request.opened: 更新任务的 pr_url 字段
 * - pull_request.merged: 标记任务为 completed
 *
 * @param event - Webhook 事件
 * @param dispatcher - Action 分发器
 * @returns 桥接处理结果
 */
export async function processGitHubWebhook(
  event: WebhookEvent,
  dispatcher: ActionDispatcher
): Promise<BridgeResult> {
  let ppfIds: readonly string[];
  let actions: Action[];

  switch (event.type) {
    case "push": {
      const result = handlePushEvent(event);
      ppfIds = result.ppfIds;
      actions = result.actions;
      break;
    }
    case "pull_request": {
      const result = handlePREvent(event);
      ppfIds = result.ppfIds;
      actions = result.actions;
      break;
    }
    default: {
      return {
        matched_tasks: [],
        unmatched: [],
        actions_dispatched: [],
      };
    }
  }

  // 执行所有 Action
  const dispatched: string[] = [];
  const matched: { ppf_id: string; action: string }[] = [];
  const unmatched: string[] = [];

  for (const action of actions) {
    const result = await dispatcher.dispatch(action, null);
    if (result.success) {
      dispatched.push(action.id);
      matched.push({
        ppf_id: action.target_id,
        action: action.type,
      });
    } else {
      unmatched.push(action.target_id);
    }
  }

  // ppfIds 中没有生成 action 的视为 unmatched
  for (const id of ppfIds) {
    if (
      !matched.some((m) => m.ppf_id === id) &&
      !unmatched.includes(id)
    ) {
      unmatched.push(id);
    }
  }

  return {
    matched_tasks: matched,
    unmatched,
    actions_dispatched: dispatched,
  };
}
