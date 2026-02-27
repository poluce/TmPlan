/**
 * 扩展注册表
 *
 * 管理 PPF 扩展的注册、查询、验证和渲染。
 * 扩展通过 ExtensionManifest 描述其元信息、schema、渲染模板和中间件。
 *
 * 注册表本身是不可变的 —— 每次注册/注销都返回新的内部状态。
 * 但为了 API 简洁性，使用 class 封装，内部通过 Map 替换实现不可变语义。
 */

import {
  ExtensionManifestSchema,
  type ExtensionManifest,
} from "@/types/extension";
import type { ActionMiddleware } from "@/types/action-protocol";

// ============================================================
// 扩展注册表
// ============================================================

/**
 * 扩展注册表
 *
 * 管理所有已注册扩展的生命周期，提供：
 * - 注册/注销扩展
 * - 查询扩展清单
 * - 获取扩展中间件
 * - 验证扩展数据
 * - 获取 LLM 提示
 * - 渲染扩展字段
 */
export class ExtensionRegistry {
  private extensions: ReadonlyMap<string, ExtensionManifest>;
  private middlewareMap: ReadonlyMap<string, readonly ActionMiddleware[]>;

  constructor() {
    this.extensions = new Map();
    this.middlewareMap = new Map();
  }

  /**
   * 注册扩展
   *
   * 验证清单格式后加入注册表。如果扩展 ID 已存在，会覆盖旧的注册。
   *
   * @param manifest - 扩展清单
   * @throws 清单格式不合法时抛出 ZodError
   */
  register(manifest: ExtensionManifest): void {
    const validated = ExtensionManifestSchema.parse(manifest);
    const newMap = new Map(this.extensions);
    newMap.set(validated.id, validated);
    this.extensions = newMap;
  }

  /**
   * 注销扩展
   *
   * @param extensionId - 扩展 ID
   * @throws 扩展不存在时抛出错误
   */
  unregister(extensionId: string): void {
    if (!this.extensions.has(extensionId)) {
      throw new Error(`扩展 "${extensionId}" 未注册`);
    }
    const newMap = new Map(this.extensions);
    newMap.delete(extensionId);
    this.extensions = newMap;

    // 同时清理中间件
    const newMwMap = new Map(this.middlewareMap);
    newMwMap.delete(extensionId);
    this.middlewareMap = newMwMap;
  }

  /**
   * 获取扩展清单
   *
   * @param extensionId - 扩展 ID
   * @returns 扩展清单，不存在时返回 undefined
   */
  get(extensionId: string): ExtensionManifest | undefined {
    return this.extensions.get(extensionId);
  }

  /**
   * 列出所有已注册的扩展
   *
   * @returns 扩展清单数组（不可变副本）
   */
  list(): readonly ExtensionManifest[] {
    return [...this.extensions.values()];
  }

  /**
   * 检查扩展是否已注册
   *
   * @param extensionId - 扩展 ID
   */
  isRegistered(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }

  /**
   * 注册扩展中间件
   *
   * @param extensionId - 扩展 ID
   * @param middlewares - 中间件列表
   * @throws 扩展未注册时抛出错误
   */
  registerMiddleware(
    extensionId: string,
    middlewares: readonly ActionMiddleware[]
  ): void {
    if (!this.extensions.has(extensionId)) {
      throw new Error(`扩展 "${extensionId}" 未注册，无法添加中间件`);
    }
    const newMap = new Map(this.middlewareMap);
    newMap.set(extensionId, [...middlewares]);
    this.middlewareMap = newMap;
  }

  /**
   * 获取扩展的中间件列表
   *
   * @param extensionId - 扩展 ID
   * @returns 中间件数组，扩展不存在时返回空数组
   */
  getMiddleware(extensionId: string): readonly ActionMiddleware[] {
    return this.middlewareMap.get(extensionId) ?? [];
  }

  /**
   * 验证扩展数据
   *
   * 根据扩展清单中的 schemas 定义验证实体的 extensions 字段数据。
   * 当前实现为简单的类型检查，后续可扩展为完整的 JSON Schema 验证。
   *
   * @param extensionId - 扩展 ID
   * @param entityType - 实体类型
   * @param data - 要验证的数据
   * @returns 验证是否通过
   */
  validateExtensionData(
    extensionId: string,
    entityType: string,
    data: unknown
  ): boolean {
    const manifest = this.extensions.get(extensionId);
    if (!manifest) return false;

    // 检查扩展是否适用于该实体类型
    if (
      manifest.entity_types.length > 0 &&
      !manifest.entity_types.includes(entityType as never)
    ) {
      return false;
    }

    // 检查 schemas 中定义的字段
    if (typeof data !== "object" || data === null) {
      return Object.keys(manifest.schemas).length === 0;
    }

    const dataObj = data as Record<string, unknown>;
    for (const [fieldName, schemaDef] of Object.entries(manifest.schemas)) {
      const value = dataObj[fieldName];

      // 简单类型检查（基于 schema 定义中的 type 字段）
      if (
        typeof schemaDef === "object" &&
        schemaDef !== null &&
        "type" in schemaDef
      ) {
        const expectedType = (schemaDef as Record<string, unknown>)
          .type as string;
        if (value !== undefined && typeof value !== expectedType) {
          return false;
        }

        // 检查 required
        const required = (schemaDef as Record<string, unknown>).required;
        if (required === true && value === undefined) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 获取扩展的 LLM 提示列表
   *
   * 返回扩展定义的 llm_hints，供 AI 引导时使用。
   *
   * @param extensionId - 扩展 ID
   * @returns LLM 提示字符串数组，扩展不存在时返回空数组
   */
  getLLMHints(extensionId: string): readonly string[] {
    const manifest = this.extensions.get(extensionId);
    if (!manifest) return [];
    return [...manifest.llm_hints];
  }

  /**
   * 获取所有已注册扩展的 LLM 提示
   *
   * @returns 所有扩展的 LLM 提示，按扩展 ID 分组
   */
  getAllLLMHints(): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, readonly string[]>();
    for (const [id, manifest] of this.extensions) {
      if (manifest.llm_hints.length > 0) {
        result.set(id, [...manifest.llm_hints]);
      }
    }
    return result;
  }

  /**
   * 渲染扩展字段为 Markdown 文本
   *
   * 根据扩展清单中的 markdown_renderers 模板渲染字段值。
   * 模板使用 {value} 占位符。
   *
   * @param extensionId - 扩展 ID
   * @param fieldName - 字段名
   * @param value - 字段值
   * @returns 渲染后的文本，无模板时返回值的字符串形式
   */
  renderExtensionField(
    extensionId: string,
    fieldName: string,
    value: unknown
  ): string {
    const manifest = this.extensions.get(extensionId);
    if (!manifest) return String(value);

    const template = manifest.markdown_renderers[fieldName];
    if (!template) return String(value);

    return template.replace(/\{value\}/g, String(value));
  }

  /**
   * 渲染实体的所有扩展字段
   *
   * @param extensionId - 扩展 ID
   * @param data - 扩展数据对象
   * @returns 渲染后的字段映射
   */
  renderAllFields(
    extensionId: string,
    data: Record<string, unknown>
  ): ReadonlyMap<string, string> {
    const result = new Map<string, string>();
    for (const [fieldName, value] of Object.entries(data)) {
      result.set(fieldName, this.renderExtensionField(extensionId, fieldName, value));
    }
    return result;
  }
}
