/**
 * PPF v1.0 -> v2.0 自动迁移模块
 *
 * 将 TmPlan v1.0 格式的数据迁移到 PPF v2.0 格式：
 * - 为每个实体生成 ppf_id（ppf_ 前缀 + 12 位 nanoid）
 * - 添加空 extensions 和新增字段的默认值
 * - 升级 schema_version 到 "2.0"
 * - 保留所有原有字段值
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";
import type {
  ProjectConfig,
  ModulePlan,
  ModuleTask,
  Decision,
  PhaseConfig,
} from "@/types/tmplan";
import {
  generatePPFId,
  PPFTaskSchema,
  PPFModuleSchema,
  PPFDecisionSchema,
  PPFPhaseSchema,
  PPFProjectSchema,
} from "@/types/ppf";
import type {
  PPFProject,
  PPFModule,
  PPFTask,
  PPFDecision,
  PPFPhase,
} from "@/types/ppf";

const TMPLAN_DIR = ".tmplan";

/**
 * 检测项目数据的 schema 版本
 * @param project - 待检测的项目数据（未知结构）
 * @returns "1.0" 或 "2.0"
 */
export function detectVersion(project: unknown): "1.0" | "2.0" {
  if (
    typeof project === "object" &&
    project !== null &&
    "schema_version" in project
  ) {
    const version = (project as Record<string, unknown>).schema_version;
    if (version === "2.0") return "2.0";
  }
  return "1.0";
}

/**
 * 判断项目数据是否需要迁移
 * @param project - 待检测的项目数据
 * @returns 如果是 v1.0 格式则返回 true
 */
export function needsMigration(project: unknown): boolean {
  return detectVersion(project) === "1.0";
}

/**
 * 迁移单个任务到 v2.0 格式
 * @param v1 - v1.0 任务数据
 * @returns v2.0 PPFTask（通过 Zod schema 解析，自动填充默认值）
 */
function migrateTask(v1: ModuleTask): PPFTask {
  return PPFTaskSchema.parse({
    ...v1,
    ppf_id: generatePPFId(),
    extensions: {},
    assignee: "",
    tags: [],
    due_date: null,
  });
}

/**
 * 迁移模块到 v2.0 格式（含所有任务）
 * @param v1 - v1.0 模块数据
 * @returns v2.0 PPFModule
 */
export function migrateModule(v1: ModulePlan): PPFModule {
  const migratedTasks = v1.tasks.map(migrateTask);
  return PPFModuleSchema.parse({
    ...v1,
    ppf_id: generatePPFId(),
    extensions: {},
    tags: [],
    source: "",
    tasks: migratedTasks,
  });
}

/**
 * 迁移决策到 v2.0 格式
 * @param v1 - v1.0 决策数据
 * @returns v2.0 PPFDecision
 */
export function migrateDecision(v1: Decision): PPFDecision {
  return PPFDecisionSchema.parse({
    ...v1,
    ppf_id: generatePPFId(),
    extensions: {},
  });
}

/**
 * 迁移阶段到 v2.0 格式
 * @param v1 - v1.0 阶段配置
 * @returns v2.0 PPFPhase
 */
export function migratePhase(v1: PhaseConfig): PPFPhase {
  return PPFPhaseSchema.parse({
    ...v1,
    ppf_id: generatePPFId(),
    extensions: {},
  });
}

/**
 * 迁移项目配置到 v2.0 格式
 * @param v1 - v1.0 项目配置
 * @returns v2.0 PPFProject（通过 Zod schema 解析，自动填充默认值）
 */
export function migrateProject(v1: ProjectConfig): PPFProject {
  return PPFProjectSchema.parse({
    ...v1,
    schema_version: "2.0",
    ppf_id: generatePPFId(),
    extensions: {},
    plan_version: 1,
    plan_status: "draft",
    metadata: {
      target_users: [],
      ui_pages: [],
      source: "",
      tags: [],
    },
  });
}

/**
 * 安全读取 YAML 文件
 * @param filePath - 文件路径
 * @returns 解析后的数据，文件不存在时返回 null
 */
async function safeReadYaml(filePath: string): Promise<unknown> {
  try {
    const content = await readFile(filePath, "utf-8");
    return yaml.load(content);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * 安全读取目录下所有 YAML 文件
 * @param dirPath - 目录路径
 * @returns YAML 文件内容数组
 */
async function readYamlDir(dirPath: string): Promise<unknown[]> {
  let files: string[];
  try {
    files = await readdir(dirPath);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw err;
  }

  const yamlFiles = files.filter((f) => f.endsWith(".yaml")).sort();
  const results: unknown[] = [];
  for (const f of yamlFiles) {
    const data = await safeReadYaml(join(dirPath, f));
    if (data !== null) {
      results.push(data);
    }
  }
  return results;
}

/**
 * 写入 YAML 文件
 * @param filePath - 文件路径
 * @param data - 要写入的数据
 */
async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const content = yaml.dump(data, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  await writeFile(filePath, content, "utf-8");
}

/**
 * 批量迁移整个 .tmplan/ 目录到 v2.0 格式
 *
 * 流程：
 * 1. 读取 project.yaml，检测版本
 * 2. 如果已是 v2.0 则跳过
 * 3. 迁移 project、modules、decisions、phases
 * 4. 写回所有文件（原地更新）
 * 5. 创建 events 目录（为事件溯源做准备）
 *
 * @param basePath - 项目根目录路径
 */
export async function migrateAll(basePath: string): Promise<void> {
  const tmplanDir = join(basePath, TMPLAN_DIR);

  // 读取项目配置
  const projectData = await safeReadYaml(join(tmplanDir, "project.yaml"));
  if (projectData === null) {
    throw new Error(`未找到项目配置文件: ${join(tmplanDir, "project.yaml")}`);
  }

  // 检测版本
  if (!needsMigration(projectData)) {
    return; // 已是 v2.0，无需迁移
  }

  const v1Project = projectData as ProjectConfig;

  // 迁移模块
  const modulesData = await readYamlDir(join(tmplanDir, "modules"));
  const migratedModules = modulesData.map((m) =>
    migrateModule(m as ModulePlan)
  );

  // 迁移决策
  const decisionsData = await readYamlDir(join(tmplanDir, "decisions"));
  const migratedDecisions = decisionsData.map((d) =>
    migrateDecision(d as Decision)
  );

  // 迁移阶段
  const phasesData = await readYamlDir(join(tmplanDir, "phases"));
  const migratedPhases = phasesData.map((p) =>
    migratePhase(p as PhaseConfig)
  );

  // 迁移项目配置
  const v2Project = migrateProject(v1Project);

  // 写回 project.yaml（仅项目级字段，不含 modules/decisions/phases）
  await writeYaml(join(tmplanDir, "project.yaml"), {
    ppf_id: v2Project.ppf_id,
    schema_version: v2Project.schema_version,
    name: v2Project.name,
    description: v2Project.description,
    tech_stack: [...v2Project.tech_stack],
    created_at: v2Project.created_at,
    updated_at: new Date().toISOString(),
    plan_version: v2Project.plan_version,
    plan_status: v2Project.plan_status,
    metadata: v2Project.metadata,
    extensions: v2Project.extensions,
  });

  // 写回各模块文件
  const modulesDir = join(tmplanDir, "modules");
  await mkdir(modulesDir, { recursive: true });
  for (const mod of migratedModules) {
    await writeYaml(join(modulesDir, `${mod.slug}.yaml`), mod);
  }

  // 写回各决策文件
  const decisionsDir = join(tmplanDir, "decisions");
  await mkdir(decisionsDir, { recursive: true });
  for (const dec of migratedDecisions) {
    const fileName = `${String(dec.decision_id).padStart(3, "0")}-${dec.question
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "")
      .toLowerCase()}.yaml`;
    await writeYaml(join(decisionsDir, fileName), dec);
  }

  // 写回各阶段文件
  const phasesDir = join(tmplanDir, "phases");
  await mkdir(phasesDir, { recursive: true });
  for (const phase of migratedPhases) {
    const fileName = `phase-${phase.order}-${phase.slug}.yaml`;
    await writeYaml(join(phasesDir, fileName), phase);
  }

  // 创建 events 目录（为事件溯源做准备）
  await mkdir(join(tmplanDir, "events"), { recursive: true });
}
