# TmPlan 统一计划格式规范 v1.0

> 本文档定义了 TmPlan 项目计划的规范格式，涵盖数据模型、生命周期管理、模块操作、导入导出等全部方面。
>
> 上层标准请配合阅读：
> `docs/project-definition-standard.md`

---

## 目录

1. [概述](#1-概述)
2. [目录结构](#2-目录结构)
3. [核心数据模型](#3-核心数据模型)
4. [计划生命周期](#4-计划生命周期)
5. [计划操作规范](#5-计划操作规范)
6. [模块与功能管理](#6-模块与功能管理)
7. [导入导出规范](#7-导入导出规范)
8. [验证规则](#8-验证规则)
9. [变更日志](#9-变更日志)
10. [错误处理](#10-错误处理)

---

## 1. 概述

### 1.1 背景

TmPlan 是一个基于 Next.js + Tauri 的项目管理工具，通过 AI 引导式对话帮助用户规划软件项目。当前系统存在以下问题：

- **类型系统不统一**：Zod schema（`types/tmplan.ts`）、Guide Store 的 PhaseResult 类型、API 路由内联类型三套体系互不对齐
- **缺少计划版本控制**：无法追踪计划变更历史
- **导入导出有损**：Markdown 导出丢失结构化信息，导入依赖 AI 解析不确定性高
- **缺少增量更新机制**：每次操作都是全量读写
- **缺少字段**：`target_users`、`ui_pages` 等引导阶段产生的数据无持久化位置

### 1.2 设计原则

- **向后兼容**：现有 `.tmplan/` 目录结构保持不变，新增字段使用可选默认值
- **渐进增强**：新功能通过扩展而非替换实现
- **双模式支持**：所有操作同时支持 Web（HTTP API）和 Tauri（IPC）模式
- **不可变数据**：所有操作返回新对象，不修改原始数据
- **Zod 优先**：所有数据结构以 Zod schema 为唯一真实来源

### 1.3 格式版本

| 版本 | 说明 |
|------|------|
| `1.0` | 当前版本，基础 schema |
| `1.1` | 本规范定义的扩展版本 |

---

## 2. 目录结构

### 2.1 当前结构

```
.tmplan/
├── project.yaml          # 项目配置
├── status.yaml           # 项目状态
├── modules/              # 模块计划文件
│   ├── {slug}.yaml
│   └── ...
├── decisions/            # 决策记录
│   ├── {nnn}-{slug}.yaml
│   └── ...
└── phases/               # 阶段配置
    ├── phase-{n}-{slug}.yaml
    └── ...
```

### 2.2 扩展结构（v1.1）

```
.tmplan/
├── project.yaml          # 项目配置（扩展 metadata）
├── status.yaml           # 项目状态
├── changelog.yaml        # 【新增】变更日志
├── modules/
│   ├── {slug}.yaml
│   └── ...
├── decisions/
│   ├── {nnn}-{slug}.yaml
│   └── ...
├── phases/
│   ├── phase-{n}-{slug}.yaml
│   └── ...
├── templates/            # 【新增】模块模板
│   ├── {template-id}.yaml
│   └── ...
└── imports/              # 【新增】导入元数据
    ├── manifest.yaml     # 导入记录清单
    └── sources/          # 导入源文件备份
        └── {import-id}/
            ├── original.*
            └── mapping.yaml
```

---

## 3. 核心数据模型

### 3.1 ProjectConfig（扩展后）

新增字段扩展到 `project.yaml`，作为计划元数据的统一入口。

```typescript
export const ProjectConfigSchema = z.object({
  // --- 现有字段 ---
  schema_version: z.string().default("1.1"),
  name: z.string(),
  description: z.string().default(""),
  tech_stack: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),

  // --- 新增字段（v1.1）---
  format_version: z.string().default("1.1"),
  plan_version: z.number().int().default(1),
  plan_status: z.enum(["draft", "active", "archived"]).default("draft"),
  metadata: z.object({
    target_users: z.string().default(""),
    ui_pages: z.array(z.object({
      module: z.string(),
      slug: z.string(),
      overview: z.string(),
    })).default([]),
    source: z.enum(["ai-guide", "import", "manual"]).default("ai-guide"),
    tags: z.array(z.string()).default([]),
  }).default({}),
});
```

**向后兼容**：所有新增字段都有默认值。读取 v1.0 文件时自动填充默认值。

#### 示例：project.yaml（v1.1）

```yaml
schema_version: "1.1"
format_version: "1.1"
name: 博客系统
description: 一个支持 Markdown 的现代博客平台
tech_stack:
  - Next.js 14
  - TypeScript
  - Prisma
  - PostgreSQL
plan_version: 3
plan_status: active
metadata:
  target_users: 独立博主和技术写作者
  ui_pages:
    - module: 文章管理页
      slug: post-management
      overview: 文章列表、编辑器、预览功能
    - module: 首页
      slug: homepage
      overview: 文章流、分类导航、搜索
  source: ai-guide
  tags:
    - blog
    - cms
created_at: "2026-02-26T10:00:00.000Z"
updated_at: "2026-02-26T12:30:00.000Z"
```

### 3.2 ModulePlan（模块计划）

保持现有 schema 不变，新增可选字段：

```typescript
export const ModulePlanSchema = z.object({
  // --- 现有字段（不变）---
  module: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  layer: z.enum(["feature", "implementation"]).optional().default("implementation"),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
  depends_on: z.array(z.string()).default([]),
  decision_refs: z.array(z.number()).default([]),
  overview: z.string().default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  estimated_hours: z.number().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  tasks: z.array(ModuleTaskSchema),

  // --- 新增字段（v1.1）---
  source: z.enum(["ai-guide", "import", "manual", "template"]).optional().default("ai-guide"),
  template_id: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});
```

### 3.3 ModuleTask（模块任务）

保持现有 schema 不变，新增可选字段：

```typescript
export const ModuleTaskSchema = z.object({
  // --- 现有字段（不变）---
  id: z.string().regex(/^[a-z0-9-]+-\d{2,}$/),
  title: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "blocked"]).default("pending"),
  depends_on: z.array(z.string()).default([]),
  detail: z.string().default(""),
  files_to_create: z.array(z.string()).optional().default([]),
  files_to_modify: z.array(z.string()).optional().default([]),
  acceptance_criteria: z.array(z.string()).default([]),

  // --- 新增字段（v1.1）---
  assignee: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});
```

### 3.4 Decision（决策记录）

现有 schema 保持不变，无需扩展。

### 3.5 PhaseConfig（阶段配置）

现有 schema 保持不变，无需扩展。

### 3.6 ProjectStatus（项目状态）

现有 schema 保持不变，无需扩展。

---

## 4. 计划生命周期

### 4.1 状态定义

```
draft ──→ active ──→ archived
  ↑          │
  └──────────┘ (reactivate)
```

| 状态 | 说明 | 允许的操作 |
|------|------|-----------|
| `draft` | 草稿状态，计划正在创建或编辑中 | 所有 CRUD 操作、导入、合并 |
| `active` | 活跃状态，计划已确认，正在执行 | 任务状态更新、增量添加模块（需 ImpactAnalysis 确认）、添加决策 |
| `archived` | 归档状态，计划已完成或废弃 | 只读，可重新激活 |

### 4.2 状态转换规则

```typescript
const VALID_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ["active"],
  active: ["draft", "archived"],
  archived: ["active"],
};
```

**转换条件**：

- `draft -> active`：至少有 1 个模块，项目名称非空
- `active -> draft`：无限制（用于重新编辑）
- `active -> archived`：无限制
- `archived -> active`：无限制（重新激活）

### 4.3 计划创建流程

#### 4.3.1 通过 AI 引导创建

```
concept -> features -> ui-pages -> tech-impl -> savePlan()
```

每个阶段产生 `PhaseResult`，最终通过 `savePlan()` 持久化。

**类型归一化**：引导阶段的 PhaseResult 类型需要通过归一化函数转换为持久化类型：

```typescript
function normalizePhaseResults(results: PhaseResult[]): {
  projectConfig: ProjectConfig;
  modules: ModulePlan[];
  decisions: Decision[];
}
```

该函数遍历所有 PhaseResult，按 phase 类型提取数据并映射到统一 schema。

#### 4.3.2 通过导入创建

参见第 7 节：导入导出规范。

#### 4.3.3 手动创建

调用 `initTmplan()` 创建空项目结构，然后逐步添加模块。

---

## 5. 计划操作规范

### 5.1 操作总览

| 操作 | 函数 | 输入 | 输出 | 计划状态要求 |
|------|------|------|------|-------------|
| 初始化项目 | `initTmplan` | `basePath` | `void` | 无（创建新项目） |
| 读取项目配置 | `readProject` | `basePath` | `ProjectConfig` | 任意 |
| 写入项目配置 | `writeProject` | `basePath, ProjectConfig` | `void` | draft, active |
| 读取所有模块 | `readAllModules` | `basePath` | `ModulePlan[]` | 任意 |
| 读取单个模块 | `readModule` | `basePath, slug` | `ModulePlan` | 任意 |
| 添加模块 | `addModule` | `basePath, ModulePlan` | `void` | draft, active（active 需 ImpactAnalysis） |
| 删除模块 | `removeModule` | `basePath, slug` | `void` | draft, active（active 需 ImpactAnalysis） |
| 合并模块提案 | `mergeModuleProposal` | `basePath, proposal, strategy` | `void` | draft, active |
| 更新任务状态 | `changeTaskStatus` | `basePath, slug, taskId, status` | `void` | active（自动触发 deriveModuleStatus） |
| 同步状态 | `syncStatus` | `basePath` | `ProjectStatus` | 任意 |
| 读取决策 | `readAllDecisions` | `basePath` | `Decision[]` | 任意 |
| 写入决策 | `writeDecision` | `basePath, Decision` | `void` | draft, active |
| 读取阶段 | `readPhases` | `basePath` | `PhaseConfig[]` | 任意 |
| 写入阶段 | `writePhase` | `basePath, PhaseConfig` | `void` | draft |

### 5.2 版本递增规则

每次写操作自动递增 `plan_version`：

```typescript
async function withVersionBump(
  basePath: string,
  operation: () => Promise<void>
): Promise<void> {
  const project = await readProject(basePath);
  await operation();
  project.plan_version += 1;
  project.updated_at = new Date().toISOString();
  await writeProject(basePath, project);
}
```

### 5.3 变更日志

每次写操作记录到 `changelog.yaml`：

```typescript
export const ChangelogEntrySchema = z.object({
  version: z.number().int(),
  timestamp: z.string(),
  operation: z.enum([
    "init", "add_module", "remove_module", "update_module",
    "change_task_status", "add_decision", "update_project",
    "import", "transition_status",
  ]),
  target: z.string().optional(),
  summary: z.string(),
});

export const ChangelogSchema = z.object({
  entries: z.array(ChangelogEntrySchema).default([]),
});
```

#### 示例：changelog.yaml

```yaml
entries:
  - version: 1
    timestamp: "2026-02-26T10:00:00.000Z"
    operation: init
    summary: 项目初始化
  - version: 2
    timestamp: "2026-02-26T10:05:00.000Z"
    operation: add_module
    target: user-auth
    summary: 添加用户认证模块
  - version: 3
    timestamp: "2026-02-26T10:10:00.000Z"
    operation: change_task_status
    target: user-auth/auth-01
    summary: 任务状态变更为 in_progress
```

---

## 6. 模块与功能管理

### 6.1 Active 状态下的影响分析

当计划处于 `active` 状态时，结构性变更（`addModule`、`removeModule`）需要先执行影响分析并获得确认：

```typescript
export const ImpactAnalysisSchema = z.object({
  operation: z.enum(["add_module", "remove_module"]),
  target: z.string(),
  affected_modules: z.array(z.object({
    slug: z.string(),
    impact: z.enum(["dependency_added", "dependency_removed", "blocked", "unblocked"]),
  })),
  affected_tasks: z.array(z.object({
    task_id: z.string(),
    module_slug: z.string(),
    impact: z.enum(["blocked", "unblocked", "orphaned"]),
  })),
  warnings: z.array(z.string()),
});

async function requireImpactAnalysis(
  basePath: string,
  operation: "add_module" | "remove_module",
  target: string,
): Promise<ImpactAnalysis> {
  const modules = await readAllModules(basePath);
  const affected_modules = [];
  const affected_tasks = [];
  const warnings = [];

  if (operation === "remove_module") {
    // 查找依赖此模块的其他模块
    for (const m of modules) {
      if (m.depends_on.includes(target)) {
        affected_modules.push({ slug: m.slug, impact: "blocked" as const });
        warnings.push(`模块 ${m.slug} 依赖 ${target}，删除后将失去依赖`);
      }
    }
  }

  return { operation, target, affected_modules, affected_tasks, warnings };
}
```

调用方在 `active` 状态下必须先获取 ImpactAnalysis，展示给用户确认后才执行操作。

### 6.2 模块添加流程

```typescript
async function addModule(basePath: string, module: ModulePlan): Promise<void> {
  // 1. 验证 slug 唯一性
  const existing = await readAllModules(basePath);
  if (existing.some(m => m.slug === module.slug)) {
    throw new PlanError("MODULE_DUPLICATE", `Module ${module.slug} already exists`);
  }

  // 2. 验证依赖存在性
  for (const dep of module.depends_on) {
    if (!existing.some(m => m.slug === dep)) {
      throw new PlanError("DEPENDENCY_NOT_FOUND", `Dependency ${dep} not found`);
    }
  }

  // 3. 检测循环依赖
  if (detectCycle([...existing, module])) {
    throw new PlanError("CIRCULAR_DEPENDENCY", "Circular dependency detected");
  }

  // 4. 写入模块文件
  await writeModule(basePath, module);

  // 5. 记录变更
  await appendChangelog(basePath, {
    operation: "add_module",
    target: module.slug,
    summary: `添加模块: ${module.module}`,
  });
}
```

### 6.3 模块模板

模块模板存储在 `templates/` 目录，用于快速创建常见模块：

```typescript
export const ModuleTemplateSchema = z.object({
  template_id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["auth", "crud", "api", "ui", "infra", "custom"]),
  module_template: ModulePlanSchema.omit({
    slug: true,
    created_at: true,
    updated_at: true,
  }),
});
```

### 6.4 模块合并提案

当导入或手动添加的模块与现有模块 slug 冲突时，使用 `mergeModuleProposal` 处理：

```typescript
type MergeStrategy = "replace" | "merge";

async function mergeModuleProposal(
  basePath: string,
  proposal: ModulePlan,
  strategy: MergeStrategy,
): Promise<void> {
  const existing = await readModule(basePath, proposal.slug);

  if (strategy === "replace") {
    // 完全替换现有模块
    await writeModule(basePath, proposal);
  } else {
    // 合并：保留现有任务，追加新任务（去重），合并 depends_on
    const mergedTasks = [...existing.tasks];
    for (const task of proposal.tasks) {
      if (!mergedTasks.some(t => t.id === task.id)) {
        mergedTasks.push(task);
      }
    }
    const mergedDeps = [...new Set([...existing.depends_on, ...proposal.depends_on])];
    const merged: ModulePlan = {
      ...existing,
      ...proposal,
      tasks: mergedTasks,
      depends_on: mergedDeps,
      updated_at: new Date().toISOString(),
    };
    await writeModule(basePath, merged);
  }

  await appendChangelog(basePath, {
    operation: "update_module",
    target: proposal.slug,
    summary: `合并模块提案 (${strategy}): ${proposal.module}`,
  });
}
```

### 6.5 任务变更后自动派生模块状态

任务状态变更（`changeTaskStatus`）、添加任务（`updateTask`）、删除任务（`removeTask`）后，自动调用 `deriveModuleStatus` 重新计算模块状态：

```typescript
function deriveModuleStatus(tasks: ModuleTask[]): ModulePlan["status"] {
  if (tasks.length === 0) return "pending";
  const allCompleted = tasks.every(t => t.status === "completed");
  if (allCompleted) return "completed";
  const anyInProgress = tasks.some(t => t.status === "in_progress" || t.status === "completed");
  if (anyInProgress) return "in_progress";
  return "pending";
}

// 在 changeTaskStatus 内部调用：
async function changeTaskStatus(
  basePath: string,
  moduleSlug: string,
  taskId: string,
  newStatus: ModuleTask["status"],
): Promise<void> {
  const module = await readModule(basePath, moduleSlug);
  const task = module.tasks.find(t => t.id === taskId);
  if (!task) throw new PlanError("TASK_NOT_FOUND", `Task ${taskId} not found`);

  task.status = newStatus;
  module.status = deriveModuleStatus(module.tasks);
  module.updated_at = new Date().toISOString();

  await writeModule(basePath, module);
  await appendChangelog(basePath, {
    operation: "change_task_status",
    target: `${moduleSlug}/${taskId}`,
    summary: `任务状态变更为 ${newStatus}，模块状态派生为 ${module.status}`,
  });
}
```

### 6.6 依赖图验证

```typescript
function detectCycle(modules: ModulePlan[]): boolean {
  const graph = new Map<string, string[]>();
  for (const m of modules) {
    graph.set(m.slug, m.depends_on);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) || []) {
      if (dfs(dep)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const slug of graph.keys()) {
    if (dfs(slug)) return true;
  }
  return false;
}
```

---

## 7. 导入导出规范

### 7.1 支持的格式

| 格式 | 导入 | 导出 | 说明 |
|------|------|------|------|
| YAML（.tmplan） | Yes | Yes | 原生格式，无损 |
| Markdown | Yes | Yes | 人类可读，导入需 AI 解析 |
| JSON | Yes | Yes | 程序交换格式 |

### 7.2 导出规范

#### 7.2.1 YAML 导出（原生）

直接复制 `.tmplan/` 目录，保持完整结构。

#### 7.2.2 JSON 导出

将所有 YAML 文件合并为单个 JSON 文件：

```typescript
export const PlanExportSchema = z.object({
  format_version: z.string(),
  exported_at: z.string(),
  project: ProjectConfigSchema,
  modules: z.array(ModulePlanSchema),
  decisions: z.array(DecisionSchema),
  phases: z.array(PhaseConfigSchema),
  status: ProjectStatusSchema,
});
```

#### 7.2.3 Markdown 导出

生成结构化 Markdown，包含隐藏的 YAML front matter 以支持无损往返：

```markdown
---
tmplan_format: "1.1"
plan_version: 3
exported_at: "2026-02-26T12:30:00.000Z"
---

# 博客系统

> 一个支持 Markdown 的现代博客平台

## 技术栈

- Next.js 14
- TypeScript
- Prisma
- PostgreSQL

## 模块

### 用户认证 (`user-auth`)

**状态**: pending | **优先级**: high | **依赖**: 无

概述：用户注册、登录、JWT 认证

#### 任务

- [ ] `auth-01` 实现用户注册 API
- [ ] `auth-02` 实现登录和 JWT 签发
- [x] `auth-03` 添加密码重置功能

...
```

### 7.3 导入规范

#### 7.3.1 导入流程

```
输入文件 -> 格式检测 -> 解析 -> 验证 -> 映射 -> 冲突检测 -> 写入
```

#### 7.3.2 格式检测

```typescript
function detectFormat(content: string, filename: string): ImportFormat {
  if (filename.endsWith(".json")) {
    const parsed = JSON.parse(content);
    if (parsed.format_version) return "tmplan-json";
    return "generic-json";
  }
  if (filename.endsWith(".md") || filename.endsWith(".markdown")) {
    return "markdown";
  }
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
    return "tmplan-yaml";
  }
  return "unknown";
}
```

#### 7.3.3 导入元数据

每次导入记录到 `imports/manifest.yaml`：

```typescript
export const ImportRecordSchema = z.object({
  import_id: z.string().uuid(),
  imported_at: z.string(),
  source_format: z.enum(["tmplan-json", "tmplan-yaml", "markdown", "generic-json"]),
  source_filename: z.string(),
  modules_imported: z.array(z.string()),
  decisions_imported: z.array(z.number()),
  conflicts_resolved: z.array(z.object({
    type: z.enum(["slug_collision", "decision_id_collision"]),
    original: z.string(),
    resolved: z.string(),
    strategy: z.enum(["rename", "merge", "skip"]),
  })).default([]),
});

export const ImportManifestSchema = z.object({
  imports: z.array(ImportRecordSchema).default([]),
});
```

#### 7.3.4 冲突解决策略

| 冲突类型 | 默认策略 | 可选策略 |
|----------|----------|----------|
| slug 重复 | rename（自动添加后缀） | merge, skip |
| decision_id 重复 | rename（重新编号） | skip |
| 依赖缺失 | 警告并继续 | 报错中止 |

### 7.4 导入文件组织

导入的源文件备份存储在 `imports/sources/{import-id}/` 目录：

```
imports/
├── manifest.yaml
└── sources/
    └── a1b2c3d4-.../
        ├── original.md          # 原始导入文件
        └── mapping.yaml         # 字段映射记录
```

`mapping.yaml` 记录导入时的字段映射关系：

```yaml
import_id: a1b2c3d4-...
source_format: markdown
field_mappings:
  - source_field: "## 模块名"
    target_field: module
    transform: extract_heading
  - source_field: "- [ ] 任务"
    target_field: tasks[].title
    transform: extract_checkbox
unmapped_fields:
  - "自定义备注段落"
```

---

## 8. 验证规则

### 8.1 Schema 验证

所有数据在读写时通过 Zod schema 验证：

```typescript
function validateAndParse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new PlanValidationError(result.error);
  }
  return result.data;
}
```

### 8.2 业务规则验证

| 规则 | 检查时机 | 错误码 |
|------|----------|--------|
| slug 唯一性 | 添加模块时 | `MODULE_DUPLICATE` |
| 依赖存在性 | 添加/更新模块时 | `DEPENDENCY_NOT_FOUND` |
| 无循环依赖 | 添加/更新模块时 | `CIRCULAR_DEPENDENCY` |
| 任务 ID 唯一性（模块内） | 模块内 | `TASK_DUPLICATE` |
| 任务 ID 唯一性（跨模块） | 添加/更新模块时 | `TASK_ID_CONFLICT` |
| decision_refs 有效性 | 添加/更新模块时 | `INVALID_DECISION_REF` |
| 状态转换合法性 | 变更计划状态时 | `INVALID_TRANSITION` |
| 操作权限 | 所有写操作 | `OPERATION_NOT_ALLOWED` |

### 8.3 完整性检查

定期运行的完整性检查函数：

```typescript
async function validatePlanIntegrity(basePath: string): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 检查所有模块文件可解析
  // 2. 检查依赖图无环
  // 3. 检查所有 decision_refs 指向存在的决策
  // 4. 检查 status.yaml 与实际模块/任务状态一致
  // 5. 检查 changelog 版本连续性
  // 6. 检查跨模块任务 ID 唯一性
  // 7. 检查模块状态与任务状态一致（deriveModuleStatus）

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## 9. 变更日志格式

### 9.1 changelog.yaml 结构

参见 5.3 节的 ChangelogSchema 定义。

### 9.2 版本号规则

- 版本号从 1 开始，每次写操作递增 1
- 版本号存储在 `project.yaml` 的 `plan_version` 字段
- changelog 中的 version 与 plan_version 对应

---

## 10. 错误处理

### 10.1 错误类型

```typescript
export class PlanError extends Error {
  constructor(
    public code: PlanErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PlanError";
  }
}

export type PlanErrorCode =
  | "MODULE_DUPLICATE"
  | "MODULE_NOT_FOUND"
  | "DEPENDENCY_NOT_FOUND"
  | "CIRCULAR_DEPENDENCY"
  | "TASK_DUPLICATE"
  | "TASK_ID_CONFLICT"
  | "TASK_NOT_FOUND"
  | "INVALID_DECISION_REF"
  | "INVALID_TRANSITION"
  | "OPERATION_NOT_ALLOWED"
  | "IMPACT_ANALYSIS_REQUIRED"
  | "VALIDATION_FAILED"
  | "IMPORT_FAILED"
  | "FORMAT_UNSUPPORTED"
  | "FILE_NOT_FOUND"
  | "PARSE_ERROR";
```

### 10.2 错误恢复

- 所有写操作使用 try-catch 包装
- 写入失败时不修改原文件（先写临时文件，成功后重命名）
- 导入失败时回滚所有已写入的文件

---

## 附录 A：迁移指南（v1.0 -> v1.1）

### A.1 自动迁移

读取 v1.0 文件时，Zod schema 的默认值机制自动填充新增字段，无需手动迁移。

### A.2 显式迁移

可选的显式迁移函数，为现有项目添加 changelog 和 metadata：

```typescript
async function migrateToV1_1(basePath: string): Promise<void> {
  const project = await readProject(basePath);

  if (project.format_version === "1.1") return; // 已迁移

  project.format_version = "1.1";
  project.plan_version = project.plan_version || 1;
  project.plan_status = project.plan_status || "draft";
  project.metadata = project.metadata || {
    target_users: "",
    ui_pages: [],
    source: "manual",
    tags: [],
  };

  await writeProject(basePath, project);

  // 初始化 changelog
  await writeChangelog(basePath, {
    entries: [{
      version: project.plan_version,
      timestamp: new Date().toISOString(),
      operation: "init",
      summary: "从 v1.0 迁移到 v1.1",
    }],
  });
}
```

---

## 附录 B：API 路由映射

| 操作 | Web API 路由 | Tauri IPC 命令 |
|------|-------------|---------------|
| 初始化 | `POST /api/tmplan/init` | `tmplan_init` |
| 读取项目 | `GET /api/tmplan/project` | `tmplan_read_project` |
| 写入项目 | `PUT /api/tmplan/project` | `tmplan_write_project` |
| 读取模块列表 | `GET /api/tmplan/modules` | `tmplan_read_modules` |
| 读取单个模块 | `GET /api/tmplan/modules/:slug` | `tmplan_read_module` |
| 添加模块 | `POST /api/tmplan/modules` | `tmplan_add_module` |
| 删除模块 | `DELETE /api/tmplan/modules/:slug` | `tmplan_remove_module` |
| 更新任务状态 | `PATCH /api/tmplan/modules/:slug/tasks/:taskId` | `tmplan_change_task` |
| 同步状态 | `POST /api/tmplan/sync-status` | `tmplan_sync_status` |
| 导出 | `POST /api/tmplan/export` | `tmplan_export` |
| 导入 | `POST /api/tmplan/import` | `tmplan_import` |
| 变更计划状态 | `PATCH /api/tmplan/status` | `tmplan_transition` |
