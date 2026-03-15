# TmPlan 项目定义标准 v0.1

> 这份标准回答一个核心问题：TmPlan 内部到底以什么为“完整项目定义”。
> 结论是：先定义内部标准，再让外部文档持续填空，而不是让外部文档直接决定内部结构。

---

## 1. 目标

TmPlan 需要一套稳定的内部项目标准，用来：

- 统一描述一个项目从立项到收尾的全部信息
- 约束 AI 导入、手动录入、Markdown 导入的目标格式
- 区分“已确认信息”“缺失信息”“冲突信息”
- 支持后续的持续补全，而不是一次性生成

这意味着：

- 外部文档可以很乱
- 内部结构不能乱
- 导入动作本质上是“映射到标准槽位”

---

## 2. 基本原则

### 2.1 标准优先

TmPlan 内部必须先有固定的文档类型、固定字段、固定状态枚举、固定生命周期阶段。

### 2.2 文档填空

外部输入的 Markdown、PRD、设计稿说明、会议纪要，都只能做三件事：

- 填补空白字段
- 细化已有字段
- 触发冲突待确认

### 2.3 结构与语义分离

- 结构层：字段、类型、枚举、关系
- 语义层：字段里到底写什么

TmPlan 当前已有结构层基础，但还需要补齐语义层标准。

### 2.4 生命周期完整

内部标准必须覆盖：

- 立项
- 需求
- 设计
- 技术
- 执行
- 质量
- 发布运维
- 收尾复盘

### 2.5 可追溯

每个关键信息都应该能回答：

- 它来自哪份文档
- 是谁确认的
- 当前状态是什么
- 后续是否被覆盖或冲突

---

## 3. 生命周期标准文档集

下表定义 TmPlan 的核心项目文档集。

| 阶段 | 文档类型 | 文件建议名 | 是否必需 | 作用 |
|------|----------|------------|----------|------|
| 立项 | Project Charter | `01-project-charter.md` | 必需 | 定义项目为何存在、做什么、不做什么 |
| 需求 | Product Requirements Document | `02-product-requirements.md` | 必需 | 定义用户、场景、功能、范围、验收 |
| 设计 | UX / IA Spec | `03-ux-spec.md` | 必需 | 定义页面、流程、交互、信息架构 |
| 技术 | System Design | `04-system-design.md` | 必需 | 定义架构、模块、数据、接口、约束 |
| 技术 | ADR Log | `05-adr-log.md` | 建议 | 记录关键技术决策及原因 |
| 执行 | Execution Plan | `06-execution-plan.md` | 必需 | 定义里程碑、任务分解、依赖、风险 |
| 质量 | QA & Acceptance Plan | `07-qa-acceptance.md` | 必需 | 定义测试策略、质量门禁、验收方案 |
| 发布运维 | Release & Operations Plan | `08-release-operations.md` | 建议 | 定义部署、监控、回滚、运维责任 |
| 收尾 | Retrospective & Closure | `09-retrospective.md` | 建议 | 记录结果、复盘、遗留问题、后续路线 |

补充说明：

- “必需”表示项目标准模型里必须有对应槽位，不代表一开始就要写满。
- “建议”表示可以为空，但内部模型应该保留位置。

---

## 4. 每类文档的最小必填内容

### 4.1 Project Charter

必须回答：

- 项目名称是什么
- 要解决什么问题
- 目标用户是谁
- 目标是什么
- 不做什么
- 关键约束是什么
- 成功如何衡量

最小必填字段：

- `problem_statement`
- `target_users`
- `goals`
- `non_goals`
- `constraints`
- `success_metrics`

### 4.2 Product Requirements Document

必须回答：

- 用户有哪些核心场景
- MVP 范围是什么
- 功能模块有哪些
- 各模块优先级如何
- 关键业务规则是什么
- 验收标准是什么

最小必填字段：

- `personas`
- `user_scenarios`
- `feature_list`
- `mvp_scope`
- `out_of_scope`
- `business_rules`
- `acceptance_rules`

### 4.3 UX / IA Spec

必须回答：

- 需要哪些页面
- 页面之间的流转关系是什么
- 核心交互是什么
- 是否有响应式或多端差异
- 信息架构如何组织

最小必填字段：

- `page_inventory`
- `navigation_map`
- `key_flows`
- `interaction_rules`
- `content_structure`

### 4.4 System Design

必须回答：

- 系统分层与模块边界是什么
- 技术栈是什么
- 数据模型是什么
- API 契约是什么
- 非功能要求是什么
- 依赖哪些外部系统

最小必填字段：

- `architecture_overview`
- `tech_stack`
- `module_boundaries`
- `data_model`
- `api_contracts`
- `nfr`
- `external_dependencies`

### 4.5 ADR Log

必须回答：

- 做了什么决策
- 备选方案有哪些
- 为什么选这个
- 影响了哪些模块
- 是否替代历史决策

最小必填字段：

- `decision_id`
- `question`
- `options`
- `chosen`
- `reason`
- `impact`

### 4.6 Execution Plan

必须回答：

- 项目怎么拆阶段
- 里程碑是什么
- 模块与任务怎么拆
- 任务依赖是什么
- 风险有哪些
- 谁负责什么

最小必填字段：

- `phases`
- `milestones`
- `module_plan`
- `task_breakdown`
- `dependency_map`
- `risk_register`
- `owners`

### 4.7 QA & Acceptance Plan

必须回答：

- 怎么测试
- 不同层级测试覆盖什么
- 质量门禁是什么
- 验收入口和退出条件是什么

最小必填字段：

- `test_strategy`
- `test_levels`
- `quality_gates`
- `acceptance_checklist`
- `defect_policy`

### 4.8 Release & Operations Plan

必须回答：

- 怎么部署
- 如何回滚
- 监控什么
- 告警给谁
- 运维职责如何分工

最小必填字段：

- `environments`
- `release_process`
- `rollback_plan`
- `monitoring`
- `alerts`
- `runbook`

### 4.9 Retrospective & Closure

必须回答：

- 最终结果如何
- 目标是否达成
- 遗留问题有哪些
- 后续路线图是什么
- 经验教训是什么

最小必填字段：

- `outcome_summary`
- `goal_review`
- `open_items`
- `lessons_learned`
- `follow_up_roadmap`

---

## 5. 统一文档格式

TmPlan 标准文档统一使用：

- 文件格式：`Markdown`
- 元数据：`YAML Front Matter`
- 正文结构：固定一级/二级标题

### 5.1 统一 Front Matter

所有标准文档都应包含以下公共字段：

```yaml
---
id: DOC-XXXX
type: project-charter
title: 项目章程
project: sample-project
version: 0.1.0
status: draft
lifecycle_stage: initiation
owner: ""
reviewers: []
source_refs: []
updated_at: 2026-03-14
tags: []
---
```

### 5.2 公共字段定义

| 字段 | 说明 |
|------|------|
| `id` | 文档唯一标识 |
| `type` | 文档类型 |
| `title` | 文档标题 |
| `project` | 项目标识符 |
| `version` | 文档版本 |
| `status` | 文档状态 |
| `lifecycle_stage` | 生命周期阶段 |
| `owner` | 负责人 |
| `reviewers` | 评审人列表 |
| `source_refs` | 来源文档或链接 |
| `updated_at` | 最后更新时间 |
| `tags` | 标签 |

### 5.3 标准枚举

`type`：

- `project-charter`
- `product-requirements`
- `ux-spec`
- `system-design`
- `adr-log`
- `execution-plan`
- `qa-acceptance`
- `release-operations`
- `retrospective`

`status`：

- `draft`
- `in_review`
- `confirmed`
- `approved`
- `deprecated`

`lifecycle_stage`：

- `initiation`
- `requirements`
- `design`
- `technical`
- `delivery`
- `quality`
- `release`
- `closure`

---

## 6. 导入与补全规则

这是 TmPlan 后续导入器必须遵守的规则。

### 6.1 允许的动作

外部文档导入时，只允许：

1. 为空字段补值
2. 为已有字段补充细节
3. 在冲突时生成待确认项

### 6.2 禁止的动作

外部文档导入时，不允许：

- 新造内部文档类型
- 绕过标准字段直接生成任意结构
- 用一份混乱文档覆盖整个项目定义
- 把“未知”伪装成“已确认”

### 6.3 字段状态

每个核心字段最终应支持以下状态：

- `missing`：标准需要，但还没有信息
- `draft`：已有信息，但未确认
- `confirmed`：信息已确认
- `conflict`：不同来源互相冲突

### 6.4 来源追踪

每个被导入的关键信息应尽量记录：

- `source_doc`
- `source_section`
- `imported_at`
- `confidence`

---

## 7. TmPlan 内部数据模型扩展建议

当前系统已有：

- 项目：`ProjectConfig`
- 模块：`ModulePlan`
- 任务：`ModuleTask`
- 决策：`Decision`
- PPF 2.0 扩展：`PPFProject / PPFModule / PPFTask / PPFDecision`

相关位置：

- [tmplan.ts](../apps/web/types/tmplan.ts)
- [ppf.ts](../apps/web/types/ppf.ts)

### 7.1 当前已经能承载的部分

| 标准文档 | 当前可映射到的结构 |
|----------|--------------------|
| Project Charter | `project.name`, `project.description`, `metadata.target_users` |
| Product Requirements | `modules(feature)`、部分 `overview` |
| UX / IA Spec | `metadata.ui_pages`、页面类模块 |
| System Design | `tech_stack`、`modules(implementation)` |
| ADR Log | `decisions` |
| Execution Plan | `tasks`, `depends_on`, `phases` |
| QA & Acceptance | `acceptance_criteria` |

### 7.2 当前缺失的核心槽位

内部模型还缺这些稳定字段：

- `problem_statement`
- `goals`
- `non_goals`
- `constraints`
- `success_metrics`
- `personas`
- `user_scenarios`
- `business_rules`
- `navigation_map`
- `key_flows`
- `nfr`
- `milestones`
- `risk_register`
- `quality_gates`
- `release_plan`
- `runbook`
- `lessons_learned`
- `field_sources`

### 7.3 建议扩展方向

建议在 `PPFProject.metadata` 下扩展以下结构：

```yaml
metadata:
  target_users: []
  ui_pages: []
  source: ""
  tags: []
  problem_statement: ""
  goals: []
  non_goals: []
  constraints: []
  success_metrics: []
  personas: []
  milestones: []
  risks: []
  quality_gates: []
  releases: []
  lessons_learned: []
```

再为核心实体补充字段级来源记录：

```yaml
field_sources:
  project.description:
    status: confirmed
    source_doc: 02-product-requirements.md
    source_section: 项目概述
    confidence: 0.92
```

---

## 8. 推荐目录结构

建议每个项目都逐步向以下结构靠齐：

```text
project-root/
├── docs/
│   ├── 01-project-charter.md
│   ├── 02-product-requirements.md
│   ├── 03-ux-spec.md
│   ├── 04-system-design.md
│   ├── 05-adr-log.md
│   ├── 06-execution-plan.md
│   ├── 07-qa-acceptance.md
│   ├── 08-release-operations.md
│   └── 09-retrospective.md
└── .tmplan/
    └── ...
```

`docs/` 是人类协作层，`.tmplan/` 是机器标准层。

---

## 9. 落地顺序建议

建议按以下顺序在 TmPlan 中落地：

1. 先把“项目总览”升级为标准化总览页，只展示标准槽位，不直接展示原始文档碎片。
2. 把导入逻辑改成“映射到标准字段”，而不是“从文档直接推导页面结构”。
3. 引入字段状态：`missing / draft / confirmed / conflict`。
4. 为关键字段加 `source_refs` 和 `confidence`。
5. 最后再做多文档持续补全与冲突合并。

---

## 10. 与现有系统的关系

这份文档不是替代现有计划格式规范，而是上层标准。

- [plan-format-spec.md](../apps/web/docs/plan-format-spec.md) 解决“计划如何存”
- 本文解决“一个完整项目到底应该包含什么”

两者关系是：

- 本文定义完整项目标准
- `plan-format-spec` 负责把这套标准映射为 TmPlan 的数据结构与存储格式

---

## 11. 交付件

配套模板位于：

- [docs/templates/project-definition/README.md](./templates/project-definition/README.md)
- [docs/templates/project-definition/01-project-charter.md](./templates/project-definition/01-project-charter.md)
- [docs/templates/project-definition/02-product-requirements.md](./templates/project-definition/02-product-requirements.md)
- [docs/templates/project-definition/03-ux-spec.md](./templates/project-definition/03-ux-spec.md)
- [docs/templates/project-definition/04-system-design.md](./templates/project-definition/04-system-design.md)
- [docs/templates/project-definition/05-adr-log.md](./templates/project-definition/05-adr-log.md)
- [docs/templates/project-definition/06-execution-plan.md](./templates/project-definition/06-execution-plan.md)
- [docs/templates/project-definition/07-qa-acceptance.md](./templates/project-definition/07-qa-acceptance.md)
- [docs/templates/project-definition/08-release-operations.md](./templates/project-definition/08-release-operations.md)
- [docs/templates/project-definition/09-retrospective.md](./templates/project-definition/09-retrospective.md)
