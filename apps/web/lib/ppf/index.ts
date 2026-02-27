/**
 * PPF 模块统一导出
 *
 * 汇总 migrate、action-dispatcher、event-store、handlers 的公共 API。
 */

// ============================================================
// 迁移模块
// ============================================================
export {
  detectVersion,
  needsMigration,
  migrateProject,
  migrateModule,
  migrateDecision,
  migratePhase,
  migrateAll,
} from "./migrate";

// ============================================================
// Action 分发器
// ============================================================
export { ActionDispatcher, generatePatches } from "./action-dispatcher";

// ============================================================
// Handler 注册
// ============================================================
export { registerAllHandlers } from "./handlers";
export {
  taskCreateHandler,
  taskUpdateHandler,
  taskDeleteHandler,
  taskMoveHandler,
  moduleCreateHandler,
  moduleUpdateHandler,
  moduleDeleteHandler,
} from "./handlers";

// ============================================================
// 事件存储
// ============================================================
export {
  appendEvent,
  queryEvents,
  getEventsByDate,
  createVersionTag,
  rollbackToEvent,
  getVersionTags,
} from "./event-store";

// ============================================================
// Markdown 渲染 / 解析 / 同步
// ============================================================
export { renderProjectToMarkdown } from "./markdown-renderer";
export type { RenderOptions } from "./markdown-renderer";

export { parseMarkdownToPPF } from "./markdown-parser";
export type {
  ParseResult,
  ParsedModule,
  ParsedTask,
} from "./markdown-parser";

export { syncFromMarkdown } from "./markdown-sync";
export type { SyncResult, SyncConflict } from "./markdown-sync";

// ============================================================
// 扩展注册表
// ============================================================
export { ExtensionRegistry } from "./extension-registry";

// ============================================================
// DevOps 桥接
// ============================================================
export { processGitHubWebhook } from "./devops-bridge";
export type {
  WebhookEvent,
  WebhookPushEvent,
  WebhookPREvent,
  WebhookPullRequest,
  WebhookCommit,
  BridgeResult,
} from "./devops-bridge";

// ============================================================
// AI 对齐检查
// ============================================================
export { inspectPRAlignment } from "./ai-inspector";
export type {
  InspectionResult,
  InspectParams,
  AlignmentCheck,
  AlignmentDimension,
  AlignmentLevel,
  CheckStatus,
} from "./ai-inspector";

// ============================================================
// GitHub 客户端
// ============================================================
export { GitHubClient, GitHubAPIError } from "./github-client";
export type {
  PullRequest,
  PRFile,
  Commit,
  GitHubClientOptions,
} from "./github-client";
