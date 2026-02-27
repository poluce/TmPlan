/**
 * GitHub API 客户端封装
 *
 * 使用原生 fetch API 直接调用 GitHub REST API，不依赖 @octokit/rest。
 * 所有方法包含错误处理和重试逻辑。
 *
 * 支持的操作：
 * - 获取 Pull Request 信息
 * - 获取 PR diff
 * - 创建 PR 评论
 * - 获取 PR 变更文件列表
 * - 获取 Commit 信息
 */

// ============================================================
// 类型定义
// ============================================================

/** Pull Request 信息 */
export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly merged: boolean;
  readonly state: "open" | "closed";
  readonly html_url: string;
}

/** PR 变更文件 */
export interface PRFile {
  readonly filename: string;
  readonly status: "added" | "removed" | "modified" | "renamed" | "copied";
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string | undefined;
}

/** Commit 信息 */
export interface Commit {
  readonly sha: string;
  readonly message: string;
  readonly files: readonly PRFile[];
}

/** 客户端配置选项 */
export interface GitHubClientOptions {
  /** GitHub API 基础 URL（默认 https://api.github.com） */
  readonly baseUrl?: string;
  /** 最大重试次数（默认 3） */
  readonly maxRetries?: number;
  /** 重试间隔基数（毫秒，默认 1000） */
  readonly retryDelayMs?: number;
}

/** API 错误 */
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

// ============================================================
// 内部辅助
// ============================================================

/** 延迟指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 判断是否为可重试的 HTTP 状态码 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// ============================================================
// GitHubClient
// ============================================================

/**
 * GitHub REST API 客户端
 *
 * 使用原生 fetch API，支持自动重试和错误处理。
 * 所有方法返回不可变的数据对象。
 */
export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  /**
   * @param token - GitHub Personal Access Token
   * @param options - 客户端配置
   */
  constructor(token: string, options?: GitHubClientOptions) {
    if (!token) {
      throw new Error("GitHub token 不能为空");
    }
    this.token = token;
    this.baseUrl = options?.baseUrl ?? "https://api.github.com";
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  /**
   * 发送 API 请求（含重试逻辑）
   *
   * @param path - API 路径（如 /repos/owner/repo/pulls/1）
   * @param options - fetch 选项
   * @returns 响应对象
   */
  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "TmPlan-PPF-Client",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.ok) {
          return response;
        }

        // 可重试的错误
        if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
          // 尊重 Retry-After 头
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : this.retryDelayMs * Math.pow(2, attempt);
          await delay(waitMs);
          continue;
        }

        // 不可重试的错误
        const body = await response.text();
        throw new GitHubAPIError(
          `GitHub API 请求失败: ${response.status} ${response.statusText} - ${body}`,
          response.status,
          url
        );
      } catch (err) {
        if (err instanceof GitHubAPIError) {
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));

        // 网络错误重试
        if (attempt < this.maxRetries) {
          await delay(this.retryDelayMs * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error(`请求 ${path} 失败，已达最大重试次数`);
  }

  /**
   * 发送 JSON 请求并解析响应
   */
  private async requestJSON<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await this.request(path, options);
    return (await response.json()) as T;
  }

  /**
   * 获取 Pull Request 信息
   *
   * @param owner - 仓库所有者
   * @param repo - 仓库名
   * @param prNumber - PR 编号
   * @returns Pull Request 信息
   */
  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequest> {
    const data = await this.requestJSON<Record<string, unknown>>(
      `/repos/${owner}/${repo}/pulls/${prNumber}`
    );

    return {
      number: data.number as number,
      title: data.title as string,
      body: (data.body as string) ?? null,
      head: { ref: (data.head as Record<string, unknown>).ref as string },
      base: { ref: (data.base as Record<string, unknown>).ref as string },
      merged: data.merged as boolean,
      state: data.state as "open" | "closed",
      html_url: data.html_url as string,
    };
  }

  /**
   * 获取 PR 的 unified diff
   *
   * @param owner - 仓库所有者
   * @param repo - 仓库名
   * @param prNumber - PR 编号
   * @returns unified diff 文本
   */
  async getPRDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<string> {
    const response = await this.request(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: "application/vnd.github.v3.diff",
        },
      }
    );
    return response.text();
  }

  /**
   * 创建 PR 评论
   *
   * @param owner - 仓库所有者
   * @param repo - 仓库名
   * @param prNumber - PR 编号
   * @param body - 评论内容（Markdown）
   */
  async createPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }
    );
  }

  /**
   * 获取 PR 变更文件列表
   *
   * @param owner - 仓库所有者
   * @param repo - 仓库名
   * @param prNumber - PR 编号
   * @returns 变更文件列表
   */
  async getPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<readonly PRFile[]> {
    const data = await this.requestJSON<Record<string, unknown>[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`
    );

    return data.map((f) => ({
      filename: f.filename as string,
      status: f.status as PRFile["status"],
      additions: f.additions as number,
      deletions: f.deletions as number,
      patch: f.patch as string | undefined,
    }));
  }

  /**
   * 获取 Commit 信息
   *
   * @param owner - 仓库所有者
   * @param repo - 仓库名
   * @param sha - Commit SHA
   * @returns Commit 信息
   */
  async getCommit(
    owner: string,
    repo: string,
    sha: string
  ): Promise<Commit> {
    const data = await this.requestJSON<Record<string, unknown>>(
      `/repos/${owner}/${repo}/commits/${sha}`
    );

    const commit = data.commit as Record<string, unknown>;
    const files = (data.files as Record<string, unknown>[]) ?? [];

    return {
      sha: data.sha as string,
      message: commit.message as string,
      files: files.map((f) => ({
        filename: f.filename as string,
        status: f.status as PRFile["status"],
        additions: f.additions as number,
        deletions: f.deletions as number,
        patch: f.patch as string | undefined,
      })),
    };
  }
}
