/**
 * AI 三向对齐检查器
 *
 * 检查 PR 变更与 PPF 任务需求之间的对齐程度。
 * 通过对比需求描述、API 文档和实际代码变更，
 * 生成对齐报告和改进建议。
 *
 * 检查维度：
 * - 功能覆盖：PR 是否实现了任务要求的所有功能
 * - API 契约：变更是否符合 API 文档定义
 * - 文件变更：修改的文件是否与任务预期一致
 * - 测试覆盖：是否包含必要的测试
 *
 * 注意：实际 LLM 调用留 TODO，当前实现为基于规则的静态分析。
 */

import type { Action } from "@/types/action-protocol";

// ============================================================
// 检查结果类型
// ============================================================

/** 对齐检查维度 */
export type AlignmentDimension =
  | "功能覆盖"
  | "API 契约"
  | "文件变更"
  | "测试覆盖";

/** 检查状态 */
export type CheckStatus = "pass" | "warn" | "fail";

/** 单项对齐检查 */
export interface AlignmentCheck {
  /** 检查维度 */
  readonly dimension: AlignmentDimension;
  /** 检查状态 */
  readonly status: CheckStatus;
  /** 检查详情 */
  readonly detail: string;
  /** 证据（期望 vs 实际） */
  readonly evidence: {
    readonly expected: string;
    readonly actual: string;
  };
}

/** 对齐程度 */
export type AlignmentLevel = "aligned" | "partial" | "misaligned";

/** 检查结果 */
export interface InspectionResult {
  /** 总体对齐程度 */
  readonly alignment: AlignmentLevel;
  /** 对齐分数（0-100） */
  readonly score: number;
  /** 各维度检查结果 */
  readonly checks: readonly AlignmentCheck[];
  /** 改进建议 */
  readonly suggestions: readonly string[];
  /** 可自动执行的操作（如标记任务完成） */
  readonly auto_actions: readonly Action[];
}

/** 检查参数 */
export interface InspectParams {
  /** 任务的 ppf_id */
  readonly task_ppf_id: string;
  /** PR 的 unified diff */
  readonly pr_diff: string;
  /** 任务的需求描述（Markdown） */
  readonly requirement_markdown: string;
  /** API 文档（可选） */
  readonly api_docs: string | null;
  /** 任务的验收标准列表 */
  readonly acceptance_criteria?: readonly string[];
  /** 任务预期创建的文件 */
  readonly files_to_create?: readonly string[];
  /** 任务预期修改的文件 */
  readonly files_to_modify?: readonly string[];
}

// ============================================================
// Diff 解析辅助
// ============================================================

/** 从 unified diff 中提取变更的文件列表 */
function extractChangedFiles(diff: string): readonly string[] {
  const files: string[] = [];
  const regex = /^(?:diff --git a\/(.+?) b\/|(?:\+\+\+|---) [ab]\/(.+))$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(diff)) !== null) {
    const file = match[1] ?? match[2];
    if (file && !files.includes(file)) {
      files.push(file);
    }
  }

  return files;
}

/** 从 unified diff 中提取新增行 */
function extractAddedLines(diff: string): readonly string[] {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

/** 检查 diff 中是否包含测试文件 */
function hasTestFiles(changedFiles: readonly string[]): boolean {
  return changedFiles.some(
    (f) =>
      f.includes(".test.") ||
      f.includes(".spec.") ||
      f.includes("__tests__") ||
      f.includes("/test/") ||
      f.includes("/tests/")
  );
}

// ============================================================
// 各维度检查实现
// ============================================================

/**
 * 检查功能覆盖
 *
 * 基于验收标准和需求描述，检查 PR 是否覆盖了所需功能。
 * 当前实现：关键词匹配（后续可替换为 LLM 语义分析）。
 */
function checkFunctionCoverage(params: InspectParams): AlignmentCheck {
  const criteria = params.acceptance_criteria ?? [];
  const addedLines = extractAddedLines(params.pr_diff).join("\n");

  if (criteria.length === 0) {
    return {
      dimension: "功能覆盖",
      status: "warn",
      detail: "任务未定义验收标准，无法自动验证功能覆盖",
      evidence: {
        expected: "验收标准列表",
        actual: "未定义",
      },
    };
  }

  // 简单关键词匹配：检查每个验收标准中的关键词是否在代码中出现
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const criterion of criteria) {
    // 提取关键词（去除常见停用词，取长度 > 2 的词）
    const keywords = criterion
      .split(/[\s,，。.、]+/)
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());

    const isMatched = keywords.some(
      (kw) =>
        addedLines.toLowerCase().includes(kw) ||
        params.pr_diff.toLowerCase().includes(kw)
    );

    if (isMatched) {
      matched.push(criterion);
    } else {
      unmatched.push(criterion);
    }
  }

  const ratio = matched.length / criteria.length;

  if (ratio >= 0.8) {
    return {
      dimension: "功能覆盖",
      status: "pass",
      detail: `${matched.length}/${criteria.length} 个验收标准在代码变更中找到关联`,
      evidence: {
        expected: criteria.join("; "),
        actual: `已覆盖: ${matched.join("; ")}`,
      },
    };
  }

  if (ratio >= 0.5) {
    return {
      dimension: "功能覆盖",
      status: "warn",
      detail: `仅 ${matched.length}/${criteria.length} 个验收标准有关联，可能存在遗漏`,
      evidence: {
        expected: criteria.join("; "),
        actual: `未覆盖: ${unmatched.join("; ")}`,
      },
    };
  }

  return {
    dimension: "功能覆盖",
    status: "fail",
    detail: `仅 ${matched.length}/${criteria.length} 个验收标准有关联，功能覆盖不足`,
    evidence: {
      expected: criteria.join("; "),
      actual: `未覆盖: ${unmatched.join("; ")}`,
    },
  };
}

/**
 * 检查 API 契约
 *
 * 如果提供了 API 文档，检查 PR 变更是否符合 API 定义。
 */
function checkAPIContract(params: InspectParams): AlignmentCheck {
  if (!params.api_docs) {
    return {
      dimension: "API 契约",
      status: "pass",
      detail: "未提供 API 文档，跳过契约检查",
      evidence: {
        expected: "N/A",
        actual: "N/A",
      },
    };
  }

  // TODO: 使用 LLM 进行语义级 API 契约对比
  // 当前实现：检查 API 文档中的路径是否在代码中出现
  const addedLines = extractAddedLines(params.pr_diff).join("\n");

  // 提取 API 路径模式（如 /api/xxx, GET /xxx）
  const apiPathRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)/gi;
  let match: RegExpExecArray | null;
  const apiPaths: string[] = [];

  while ((match = apiPathRegex.exec(params.api_docs)) !== null) {
    apiPaths.push(match[1]);
  }

  if (apiPaths.length === 0) {
    return {
      dimension: "API 契约",
      status: "pass",
      detail: "API 文档中未检测到路径定义",
      evidence: {
        expected: "API 路径",
        actual: "未检测到",
      },
    };
  }

  const foundPaths = apiPaths.filter((p) => addedLines.includes(p));

  if (foundPaths.length > 0) {
    return {
      dimension: "API 契约",
      status: "pass",
      detail: `在代码中找到 ${foundPaths.length}/${apiPaths.length} 个 API 路径`,
      evidence: {
        expected: apiPaths.join(", "),
        actual: foundPaths.join(", "),
      },
    };
  }

  return {
    dimension: "API 契约",
    status: "warn",
    detail: "代码中未找到 API 文档定义的路径，可能使用了不同的路由方式",
    evidence: {
      expected: apiPaths.join(", "),
      actual: "未找到匹配",
    },
  };
}

/**
 * 检查文件变更
 *
 * 对比任务预期的文件变更与 PR 实际变更的文件。
 */
function checkFileChanges(params: InspectParams): AlignmentCheck {
  const expectedCreate = params.files_to_create ?? [];
  const expectedModify = params.files_to_modify ?? [];
  const allExpected = [...expectedCreate, ...expectedModify];

  if (allExpected.length === 0) {
    return {
      dimension: "文件变更",
      status: "pass",
      detail: "任务未指定预期文件变更，跳过检查",
      evidence: {
        expected: "N/A",
        actual: "N/A",
      },
    };
  }

  const changedFiles = extractChangedFiles(params.pr_diff);

  // 模糊匹配：检查预期文件是否在变更列表中（支持路径后缀匹配）
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const expected of allExpected) {
    const normalizedExpected = expected.replace(/\\/g, "/");
    const isFound = changedFiles.some((f) => {
      const normalizedActual = f.replace(/\\/g, "/");
      return (
        normalizedActual === normalizedExpected ||
        normalizedActual.endsWith(normalizedExpected) ||
        normalizedExpected.endsWith(normalizedActual)
      );
    });

    if (isFound) {
      matched.push(expected);
    } else {
      unmatched.push(expected);
    }
  }

  const ratio = allExpected.length > 0 ? matched.length / allExpected.length : 1;

  if (ratio >= 0.8) {
    return {
      dimension: "文件变更",
      status: "pass",
      detail: `${matched.length}/${allExpected.length} 个预期文件在 PR 中有变更`,
      evidence: {
        expected: allExpected.join(", "),
        actual: changedFiles.join(", "),
      },
    };
  }

  if (ratio >= 0.5) {
    return {
      dimension: "文件变更",
      status: "warn",
      detail: `仅 ${matched.length}/${allExpected.length} 个预期文件有变更`,
      evidence: {
        expected: allExpected.join(", "),
        actual: `缺失: ${unmatched.join(", ")}`,
      },
    };
  }

  return {
    dimension: "文件变更",
    status: "fail",
    detail: `仅 ${matched.length}/${allExpected.length} 个预期文件有变更，文件覆盖不足`,
    evidence: {
      expected: allExpected.join(", "),
      actual: `缺失: ${unmatched.join(", ")}`,
    },
  };
}

/**
 * 检查测试覆盖
 *
 * 检查 PR 是否包含测试文件的变更。
 */
function checkTestCoverage(params: InspectParams): AlignmentCheck {
  const changedFiles = extractChangedFiles(params.pr_diff);
  const hasTests = hasTestFiles(changedFiles);

  if (hasTests) {
    const testFiles = changedFiles.filter(
      (f) =>
        f.includes(".test.") ||
        f.includes(".spec.") ||
        f.includes("__tests__") ||
        f.includes("/test/") ||
        f.includes("/tests/")
    );
    return {
      dimension: "测试覆盖",
      status: "pass",
      detail: `PR 包含 ${testFiles.length} 个测试文件的变更`,
      evidence: {
        expected: "包含测试文件",
        actual: testFiles.join(", "),
      },
    };
  }

  return {
    dimension: "测试覆盖",
    status: "warn",
    detail: "PR 未包含测试文件变更，建议补充测试",
    evidence: {
      expected: "包含测试文件",
      actual: "未找到测试文件变更",
    },
  };
}

// ============================================================
// 分数计算
// ============================================================

/** 检查状态对应的分数权重 */
const STATUS_SCORE: Readonly<Record<CheckStatus, number>> = {
  pass: 100,
  warn: 60,
  fail: 20,
};

/** 各维度的权重 */
const DIMENSION_WEIGHT: Readonly<Record<AlignmentDimension, number>> = {
  "功能覆盖": 0.4,
  "API 契约": 0.15,
  "文件变更": 0.25,
  "测试覆盖": 0.2,
};

/** 根据检查结果计算总分 */
function calculateScore(checks: readonly AlignmentCheck[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const check of checks) {
    const weight = DIMENSION_WEIGHT[check.dimension] ?? 0.25;
    totalWeight += weight;
    weightedScore += STATUS_SCORE[check.status] * weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

/** 根据分数判断对齐程度 */
function determineAlignment(score: number): AlignmentLevel {
  if (score >= 80) return "aligned";
  if (score >= 50) return "partial";
  return "misaligned";
}

// ============================================================
// 建议生成
// ============================================================

/** 根据检查结果生成改进建议 */
function generateSuggestions(
  checks: readonly AlignmentCheck[]
): readonly string[] {
  const suggestions: string[] = [];

  for (const check of checks) {
    if (check.status === "fail") {
      suggestions.push(
        `[${check.dimension}] ${check.detail}。请检查并补充相关实现。`
      );
    } else if (check.status === "warn") {
      suggestions.push(
        `[${check.dimension}] ${check.detail}。建议关注。`
      );
    }
  }

  return suggestions;
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 检查 PR 与 PPF 任务需求的对齐程度
 *
 * 检查流程：
 * 1. 从参数中提取需求信息（acceptance_criteria, requirement_markdown）
 * 2. 解析 PR diff 提取变更文件和内容
 * 3. 按四个维度对比需求 vs 实际变更
 * 4. 生成对齐报告
 * 5. aligned -> 返回 auto_actions（可标记任务完成）
 * 6. misaligned -> 返回 suggestions（PR 评论内容）
 *
 * @param params - 检查参数
 * @returns 检查结果
 */
export async function inspectPRAlignment(
  params: InspectParams
): Promise<InspectionResult> {
  // 执行各维度检查
  const checks: AlignmentCheck[] = [
    checkFunctionCoverage(params),
    checkAPIContract(params),
    checkFileChanges(params),
    checkTestCoverage(params),
  ];

  // 计算分数和对齐程度
  const score = calculateScore(checks);
  const alignment = determineAlignment(score);

  // 生成建议
  const suggestions = generateSuggestions(checks);

  // 生成自动操作
  const auto_actions: Action[] = [];

  // TODO: 使用 LLM 进行更深层的语义分析
  // 当前实现为基于规则的静态分析，后续可在此处集成 LLM 调用：
  // 1. 将 requirement_markdown + pr_diff 发送给 LLM
  // 2. LLM 返回结构化的对齐分析
  // 3. 合并 LLM 分析结果与静态分析结果

  if (alignment === "aligned") {
    // 对齐良好，可以自动标记任务完成
    auto_actions.push({
      id: `action_auto_${Date.now()}`,
      type: "task.update",
      target_id: params.task_ppf_id,
      payload: {
        type: "task.update",
        changes: { status: "completed" },
      },
      context: {
        source: "extension",
        actor: "ai-inspector",
        timestamp: new Date().toISOString(),
        correlation_id: `cor_inspect_${Date.now()}`,
        metadata: { inspection_score: score },
      },
    });
  }

  return {
    alignment,
    score,
    checks,
    suggestions,
    auto_actions,
  };
}
