/**
 * TmPlan Schema - 统一类型定义 (Zod)
 */
import { z } from "zod";

// ============================================================
// 状态枚举类型
// ============================================================
export type ModuleStatus = "pending" | "in_progress" | "completed";
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type ConflictType = "deviation" | "missing" | "extra";
export type Severity = "info" | "warning" | "error";
export type Priority = "low" | "medium" | "high" | "critical";

// ============================================================
// ProjectConfig
// ============================================================
export const ProjectConfigSchema = z.object({
  schema_version: z.string().default("1.0"),
  name: z.string(),
  description: z.string().default(""),
  tech_stack: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ============================================================
// ModuleTask
// ============================================================
export const ModuleTaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+-\d{2,}$/),
  title: z.string(),
  status: z
    .enum(["pending", "in_progress", "completed", "blocked"])
    .default("pending"),
  depends_on: z.array(z.string()).default([]),
  detail: z.string().default(""),
  files_to_create: z.array(z.string()).optional().default([]),
  files_to_modify: z.array(z.string()).optional().default([]),
  acceptance_criteria: z.array(z.string()).default([]),
});
export type ModuleTask = z.infer<typeof ModuleTaskSchema>;

// ============================================================
// ModulePlan
// ============================================================
export const ModulePlanSchema = z.object({
  module: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  layer: z.enum(["feature", "implementation"]).optional().default("implementation"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .default("pending"),
  depends_on: z.array(z.string()).default([]),
  decision_refs: z.array(z.number()).optional().default([]),
  overview: z.string().default(""),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .optional()
    .default("medium"),
  estimated_hours: z.number().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  tasks: z.array(ModuleTaskSchema),
});
export type ModulePlan = z.infer<typeof ModulePlanSchema>;

// ============================================================
// DecisionOption
// ============================================================
export const DecisionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

// ============================================================
// Decision
// ============================================================
export const DecisionSchema = z.object({
  decision_id: z.number(),
  question: z.string(),
  context: z.string(),
  options_presented: z.array(DecisionOptionSchema),
  chosen: z.string(),
  reason: z.string(),
  impact: z.array(z.string()).optional().default([]),
  affected_modules: z.array(z.string()).optional().default([]),
  decided_at: z.string(),
  supersedes: z.number().nullable().optional().default(null),
});
export type Decision = z.infer<typeof DecisionSchema>;

// ============================================================
// PhaseConfig
// ============================================================
export const PhaseConfigSchema = z.object({
  phase: z.string(),
  slug: z.string(),
  order: z.number(),
  description: z.string().optional().default(""),
  modules: z.array(z.string()),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .default("pending"),
});
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;

// ============================================================
// Conflict
// ============================================================
export const ConflictSchema = z.object({
  id: z.string().regex(/^conflict-\d{3,}$/),
  module: z.string(),
  task_id: z.string().nullable().optional().default(null),
  type: z.enum(["deviation", "missing", "extra"]),
  description: z.string(),
  expected: z.string().nullable().optional().default(null),
  actual: z.string().nullable().optional().default(null),
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  detected_at: z.string(),
  resolved: z.boolean().default(false),
  resolved_at: z.string().nullable().optional().default(null),
  resolution: z.string().nullable().optional().default(null),
});
export type Conflict = z.infer<typeof ConflictSchema>;

// ============================================================
// ProjectStatus
// ============================================================
export const ProjectStatusSchema = z.object({
  overall_progress: z.number().min(0).max(100).default(0),
  current_phase: z.string().default(""),
  modules_status: z
    .record(z.string(), z.enum(["pending", "in_progress", "completed"]))
    .default({}),
  last_check_at: z.string(),
  updated_at: z.string(),
  conflicts: z.array(ConflictSchema).default([]),
});
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

// ============================================================
// DependencyGraph
// ============================================================
export const DependencyGraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
