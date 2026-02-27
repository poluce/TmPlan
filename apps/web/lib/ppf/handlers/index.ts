/**
 * Handler 注册中心
 *
 * 统一注册所有 Action Handler 到 ActionDispatcher。
 */

import type { ActionDispatcher } from "../action-dispatcher";
import {
  taskCreateHandler,
  taskUpdateHandler,
  taskDeleteHandler,
  taskMoveHandler,
} from "./task-handler";
import {
  moduleCreateHandler,
  moduleUpdateHandler,
  moduleDeleteHandler,
} from "./module-handler";

/**
 * 注册所有内置 Handler 到分发器
 * @param dispatcher - Action 分发器实例
 */
export function registerAllHandlers(dispatcher: ActionDispatcher): void {
  // 任务处理器
  dispatcher.register("task.create", taskCreateHandler);
  dispatcher.register("task.update", taskUpdateHandler);
  dispatcher.register("task.delete", taskDeleteHandler);
  dispatcher.register("task.move", taskMoveHandler);

  // 模块处理器
  dispatcher.register("module.create", moduleCreateHandler);
  dispatcher.register("module.update", moduleUpdateHandler);
  dispatcher.register("module.delete", moduleDeleteHandler);
}

export {
  taskCreateHandler,
  taskUpdateHandler,
  taskDeleteHandler,
  taskMoveHandler,
} from "./task-handler";

export {
  moduleCreateHandler,
  moduleUpdateHandler,
  moduleDeleteHandler,
} from "./module-handler";
