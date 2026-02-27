/**
 * 事件存储实现
 *
 * 基于 YAML 文件的事件存储，按日期分片到 `.tmplan/events/YYYY-MM-DD.yaml`。
 * 版本标签存储在 `.tmplan/events/tags.yaml`。
 *
 * 功能：
 * - appendEvent: 追加事件到当日日志
 * - queryEvents: 按条件查询事件
 * - getEventsByDate: 按日期获取事件
 * - createVersionTag: 创建版本标签
 * - rollbackToEvent: 回滚到指定事件
 * - getVersionTags: 获取所有版本标签
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";
import {
  EventDayLogSchema,
  VersionTagSchema,
  type PPFEvent,
  type EventDayLog,
  type VersionTag,
  type EventQuery,
} from "@/types/event-sourcing";

const TMPLAN_DIR = ".tmplan";
const EVENTS_DIR = "events";
const TAGS_FILE = "tags.yaml";

/**
 * 获取事件存储目录路径
 */
function eventsDir(basePath: string): string {
  return join(basePath, TMPLAN_DIR, EVENTS_DIR);
}

/**
 * 获取指定日期的事件日志文件路径
 * @param basePath - 项目根目录
 * @param date - 日期（YYYY-MM-DD）
 */
function dayLogPath(basePath: string, date: string): string {
  return join(eventsDir(basePath), `${date}.yaml`);
}

/**
 * 获取版本标签文件路径
 */
function tagsPath(basePath: string): string {
  return join(eventsDir(basePath), TAGS_FILE);
}

/**
 * 从 ISO 时间戳中提取日期部分
 * @param timestamp - ISO 8601 时间戳
 * @returns YYYY-MM-DD 格式的日期
 */
function extractDate(timestamp: string): string {
  return timestamp.slice(0, 10);
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
 * 确保事件存储目录存在
 */
async function ensureEventsDir(basePath: string): Promise<void> {
  await mkdir(eventsDir(basePath), { recursive: true });
}

/**
 * 读取指定日期的事件日志
 * @param basePath - 项目根目录
 * @param date - 日期（YYYY-MM-DD）
 * @returns 事件日志，不存在时返回空日志
 */
async function readDayLog(
  basePath: string,
  date: string
): Promise<EventDayLog> {
  const data = await safeReadYaml(dayLogPath(basePath, date));
  if (data === null) {
    return { date, events: [] };
  }
  return EventDayLogSchema.parse(data);
}

/**
 * 追加事件到当日日志
 *
 * 根据事件的 timestamp 自动确定日期分片。
 * 如果当日日志文件不存在，会自动创建。
 *
 * @param basePath - 项目根目录
 * @param event - 要追加的事件
 */
export async function appendEvent(
  basePath: string,
  event: PPFEvent
): Promise<void> {
  await ensureEventsDir(basePath);

  const date = extractDate(event.timestamp);
  const dayLog = await readDayLog(basePath, date);

  // 不可变：创建新的事件列表
  const updatedLog: EventDayLog = {
    date,
    events: [...dayLog.events, event],
  };

  await writeYaml(dayLogPath(basePath, date), updatedLog);
}

/**
 * 按日期获取事件列表
 *
 * @param basePath - 项目根目录
 * @param date - 日期（YYYY-MM-DD）
 * @returns 当日所有事件
 */
export async function getEventsByDate(
  basePath: string,
  date: string
): Promise<PPFEvent[]> {
  const dayLog = await readDayLog(basePath, date);
  return [...dayLog.events];
}

/**
 * 查询事件
 *
 * 支持多维度过滤：日期范围、事件类型、操作者、来源、目标实体。
 * 支持分页（limit + offset）。
 *
 * @param basePath - 项目根目录
 * @param query - 查询条件
 * @returns 匹配的事件列表
 */
export async function queryEvents(
  basePath: string,
  query: EventQuery
): Promise<PPFEvent[]> {
  const dir = eventsDir(basePath);

  // 列出所有日志文件
  let files: string[];
  try {
    files = await readdir(dir);
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

  // 过滤出日期格式的 YAML 文件并排序
  const dateFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.yaml$/.test(f))
    .sort();

  // 按日期范围过滤文件
  const filteredFiles = dateFiles.filter((f) => {
    const date = f.replace(".yaml", "");
    if (query.from_date && date < query.from_date) return false;
    if (query.to_date && date > query.to_date) return false;
    return true;
  });

  // 收集所有匹配的事件
  const allEvents: PPFEvent[] = [];

  for (const f of filteredFiles) {
    const date = f.replace(".yaml", "");
    const dayLog = await readDayLog(basePath, date);

    for (const event of dayLog.events) {
      // 按类型过滤
      if (query.type && event.type !== query.type) continue;
      // 按操作者过滤
      if (query.actor && event.actor !== query.actor) continue;
      // 按来源过滤
      if (query.source && event.source !== query.source) continue;
      // 按目标实体过滤
      if (query.target_id && event.target_id !== query.target_id) continue;

      allEvents.push(event);
    }
  }

  // 分页
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 100;
  return allEvents.slice(offset, offset + limit);
}

/**
 * 创建版本标签
 *
 * 版本标签标记一个重要的事件节点，存储在 tags.yaml 中。
 *
 * @param basePath - 项目根目录
 * @param tag - 版本标签数据
 */
export async function createVersionTag(
  basePath: string,
  tag: VersionTag
): Promise<void> {
  await ensureEventsDir(basePath);

  const validatedTag = VersionTagSchema.parse(tag);
  const existing = await getVersionTags(basePath);

  // 检查标签名唯一性
  if (existing.some((t) => t.tag === validatedTag.tag)) {
    throw new Error(`版本标签 "${validatedTag.tag}" 已存在`);
  }

  const updatedTags = [...existing, validatedTag];
  await writeYaml(tagsPath(basePath), { tags: updatedTags });
}

/**
 * 获取所有版本标签
 *
 * @param basePath - 项目根目录
 * @returns 所有版本标签，按创建时间排序
 */
export async function getVersionTags(
  basePath: string
): Promise<VersionTag[]> {
  const data = await safeReadYaml(tagsPath(basePath));
  if (data === null) {
    return [];
  }

  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.tags)) {
    return [];
  }

  const tags = raw.tags.map((t: unknown) => VersionTagSchema.parse(t));
  return tags.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * 回滚到指定事件
 *
 * 返回从指定事件之后的所有事件（不含指定事件本身），
 * 这些事件需要被撤销以回滚到指定状态。
 * 事件按时间倒序排列（最新的在前），方便逐个回滚。
 *
 * @param basePath - 项目根目录
 * @param eventId - 目标事件 ID（回滚到此事件的状态）
 * @returns 需要撤销的事件列表（时间倒序）
 */
export async function rollbackToEvent(
  basePath: string,
  eventId: string
): Promise<PPFEvent[]> {
  const dir = eventsDir(basePath);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error("事件存储目录不存在");
    }
    throw err;
  }

  // 按日期排序的所有日志文件
  const dateFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.yaml$/.test(f))
    .sort();

  // 收集所有事件（按时间顺序）
  const allEvents: PPFEvent[] = [];
  for (const f of dateFiles) {
    const date = f.replace(".yaml", "");
    const dayLog = await readDayLog(basePath, date);
    allEvents.push(...dayLog.events);
  }

  // 找到目标事件的位置
  const targetIndex = allEvents.findIndex((e) => e.event_id === eventId);
  if (targetIndex === -1) {
    throw new Error(`未找到事件 "${eventId}"`);
  }

  // 返回目标事件之后的所有事件（时间倒序）
  const eventsToUndo = allEvents.slice(targetIndex + 1);
  return eventsToUndo.reverse();
}
