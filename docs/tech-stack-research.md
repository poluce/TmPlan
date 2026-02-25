# TmPlan 技术栈调研报告

## 一、展现方式对比

### 1. Web应用
| 维度 | 评价 |
|------|------|
| 开发成本 | 低，一套代码适配所有平台 |
| 用户触达 | 最广，浏览器即可访问，无需安装 |
| 更新部署 | 即时生效，用户无感知 |
| 离线能力 | 较弱，需PWA支持 |
| 性能 | 中等，受浏览器限制 |
| 系统集成 | 弱，无法访问本地文件系统等 |

### 2. 桌面应用 (Electron / Tauri)

#### Electron
| 维度 | 评价 |
|------|------|
| 生态成熟度 | 极高，VS Code/Notion/Slack等均采用 |
| 包体积 | 大（100MB+），内置Chromium |
| 内存占用 | 高 |
| 跨平台 | Windows/macOS/Linux |
| 开发体验 | 好，完整Node.js + Web技术栈 |

#### Tauri 2.0
| 维度 | 评价 |
|------|------|
| 包体积 | 极小（600KB起），使用系统WebView |
| 内存占用 | 低 |
| 跨平台 | Windows/macOS/Linux/Android/iOS |
| 后端语言 | Rust（学习曲线陡峭） |
| 生态成熟度 | 中等，2.0刚稳定，社区在快速增长 |
| 安全性 | 高，Rust内存安全 + 权限系统 |

### 3. 移动端 (React Native / Flutter)
| 维度 | 评价 |
|------|------|
| 用户体验 | 接近原生 |
| 开发成本 | 中等，需要单独维护移动端代码 |
| 推送通知 | 原生支持，适合计划提醒场景 |
| 离线能力 | 强 |

### 4. 跨平台方案对比总结

| 方案 | 开发效率 | 覆盖平台 | 性能 | 包体积 | 推荐度 |
|------|---------|---------|------|--------|--------|
| Web (PWA) | 高 | 全平台 | 中 | 无 | ★★★★★ |
| Tauri 2.0 | 中 | 5平台 | 高 | 小 | ★★★★ |
| Electron | 中 | 3平台 | 中 | 大 | ★★★ |
| React Native | 中 | 2平台 | 高 | 中 | ★★★ |

**推荐策略：Web优先 + 后期Tauri桌面端**
- 第一阶段：以Web应用（PWA）为主，快速验证产品
- 第二阶段：用Tauri打包桌面端，复用Web前端代码
- 移动端通过PWA或响应式设计覆盖

---

## 二、前端框架对比

### npm周下载量（2025年数据）
| 框架 | 周下载量 | GitHub Stars |
|------|---------|-------------|
| React | 7300万+ | 24.3万 |
| Vue | 895万+ | 5.3万 |
| Svelte | 276万+ | 8.6万 |

### 计划管理场景适配度分析

#### React
- **生态优势**：甘特图（frappe-gantt, gantt-task-react）、看板（react-beautiful-dnd, @hello-pangea/dnd）、日历（FullCalendar）等组件库最丰富
- **状态管理**：Zustand/Jotai 轻量高效，适合复杂计划数据流
- **TypeScript支持**：一流，类型安全对复杂数据结构很重要
- **社区规模**：最大，遇到问题容易找到解决方案
- **Next.js**：SSR/SSG支持，SEO友好，API Routes可做轻量后端

#### Vue
- **上手难度**：最低，模板语法直观
- **组件库**：Element Plus / Naive UI 提供丰富的企业级组件
- **甘特图**：dhtmlx-gantt 有Vue集成，但选择不如React多
- **Nuxt.js**：全栈框架，开发体验好

#### Svelte
- **性能**：编译时框架，运行时开销最小
- **包体积**：最小
- **生态**：相对较小，计划管理相关的组件库选择有限
- **SvelteKit**：全栈框架，但企业级组件库不够成熟

### 前端框架推荐：React + Next.js

理由：
1. 计划管理UI组件（甘特图、看板、时间线）的React生态最丰富
2. TypeScript一流支持，适合复杂的计划数据模型
3. Next.js提供SSR/API Routes，可减少后端工作量
4. 社区最大，招聘和维护成本最低
5. 与Tauri兼容性好，后期可无缝打包桌面端

---

## 三、后端技术选择

### AI集成便利性对比

| 技术 | AI SDK支持 | 开发效率 | 性能 | 生态 |
|------|-----------|---------|------|------|
| Node.js/TypeScript | Vercel AI SDK, LangChain.js, OpenAI SDK | 高 | 中 | 丰富 |
| Python | LangChain, LlamaIndex, OpenAI SDK | 最高 | 中 | AI生态最强 |
| Go | go-openai | 中 | 高 | AI库较少 |
| Rust | async-openai | 低 | 最高 | AI库最少 |

### 后端方案分析

#### 方案A：Next.js API Routes + Python AI微服务
- 前后端统一TypeScript，减少上下文切换
- AI密集型任务交给Python微服务处理
- 适合中小规模，架构简单

#### 方案B：Node.js (Fastify/Express) + Python AI微服务
- 前后端分离，后端更灵活
- 适合需要复杂后端逻辑的场景

#### 方案C：Python (FastAPI) 全栈后端
- AI集成最方便，LangChain/LlamaIndex原生支持
- 但前后端语言不统一

### 后端推荐：Next.js API Routes（主后端）+ Python FastAPI（AI服务）

理由：
1. Next.js API Routes处理常规CRUD，前后端TypeScript统一
2. Python FastAPI专门处理AI相关逻辑（计划生成、智能建议等）
3. 两者通过HTTP/gRPC通信，职责清晰
4. Vercel AI SDK可在Next.js中直接实现流式AI响应

---

## 四、数据库选择

### 计划数据的结构特点
- 计划有明确的层级结构（项目 > 阶段 > 任务 > 子任务）
- 任务之间有依赖关系（前置/后置任务）
- 需要时间维度的查询（甘特图、时间线）
- 用户权限和协作需要关系型查询
- AI生成的向量数据需要存储和检索

### 数据库对比

| 数据库 | 类型 | 优势 | 劣势 |
|--------|------|------|------|
| PostgreSQL | 关系型 | 结构化查询强、事务支持、pgvector向量扩展 | 水平扩展较复杂 |
| MongoDB | 文档型 | 灵活schema、嵌套文档自然 | 复杂关联查询弱 |
| SQLite | 嵌入式关系型 | 零配置、适合桌面端 | 并发写入受限 |

### 数据库推荐：PostgreSQL (通过Supabase)

理由：
1. 计划数据有强关系性（任务依赖、用户权限），关系型数据库更合适
2. pgvector扩展支持AI向量存储，无需额外向量数据库
3. Supabase提供：
   - 托管PostgreSQL + 自动REST API
   - 内置认证系统（Auth）
   - 实时订阅（Realtime）—— 适合多人协作场景
   - Row Level Security —— 数据权限控制
   - Edge Functions —— 无服务器函数
4. 开源可自托管，不被厂商锁定
5. 如果后期需要桌面离线功能，可用SQLite做本地缓存 + PostgreSQL云端同步

---

## 五、AI集成方案

### 智能计划管理的AI应用场景

1. **智能创建计划**：用户描述目标，AI生成完整的计划结构（阶段、任务、时间估算）
2. **计划完善建议**：分析现有计划，提出优化建议（风险识别、资源冲突、遗漏任务）
3. **动态调整**：根据进度偏差，自动建议计划调整方案
4. **自然语言交互**：通过对话方式修改和查询计划
5. **智能摘要**：自动生成项目进度报告

### AI集成架构

```
用户界面 (React)
    │
    ├── Vercel AI SDK (流式对话UI)
    │
    ▼
Next.js API Routes
    │
    ├── 简单AI调用 → OpenAI/Claude API 直接调用
    │
    └── 复杂AI任务 → Python FastAPI AI服务
                        │
                        ├── LangChain (对话链、Agent)
                        ├── 结构化输出 (Pydantic)
                        └── pgvector (语义搜索)
```

### 推荐的AI集成技术

| 组件 | 技术选择 | 用途 |
|------|---------|------|
| LLM提供商 | OpenAI GPT-4o / Claude API | 计划生成、对话交互 |
| 前端AI UI | Vercel AI SDK | 流式响应、对话界面 |
| AI编排 | LangChain (Python) | 复杂Agent、工具调用 |
| 结构化输出 | Pydantic + Function Calling | 确保AI输出符合计划数据结构 |
| 向量存储 | pgvector (PostgreSQL) | 语义搜索、相似计划推荐 |
| Prompt管理 | 自建模板系统 | 管理各场景的提示词 |

### 关键实现要点

1. **结构化输出**：使用Function Calling / Tool Use确保AI生成的计划数据符合预定义schema
2. **流式响应**：计划生成可能耗时较长，必须支持流式输出提升用户体验
3. **多模型支持**：抽象LLM接口，支持切换不同模型（成本/质量权衡）
4. **本地模型可选**：预留Ollama等本地模型接口，满足数据隐私需求

---

## 六、推荐技术栈组合

### 最终推荐方案

```
┌─────────────────────────────────────────────┐
│                  前端层                       │
│  React 19 + Next.js 15 + TypeScript          │
│  UI: Tailwind CSS + shadcn/ui                │
│  状态管理: Zustand                            │
│  计划组件: frappe-gantt + @hello-pangea/dnd   │
│  AI交互: Vercel AI SDK                       │
├─────────────────────────────────────────────┤
│                  后端层                       │
│  Next.js API Routes (主业务逻辑)              │
│  Python FastAPI (AI微服务)                    │
│  认证: Supabase Auth                         │
├─────────────────────────────────────────────┤
│                  数据层                       │
│  PostgreSQL (Supabase托管)                    │
│  pgvector (AI向量存储)                        │
│  Redis (可选，缓存/队列)                      │
├─────────────────────────────────────────────┤
│                  AI层                        │
│  OpenAI / Claude API                         │
│  LangChain (Python)                          │
│  结构化输出 + 流式响应                        │
├─────────────────────────────────────────────┤
│                  部署层                       │
│  Vercel (前端 + API Routes)                   │
│  Railway/Fly.io (Python AI服务)              │
│  Supabase Cloud (数据库)                      │
└─────────────────────────────────────────────┘
```

### 选择理由总结

1. **React + Next.js**：生态最丰富，计划管理UI组件选择最多，TypeScript全栈统一
2. **Supabase (PostgreSQL)**：开箱即用的认证、实时订阅、REST API，pgvector支持AI向量存储
3. **Python FastAPI AI服务**：AI生态最强，LangChain原生支持，结构化输出成熟
4. **Tailwind + shadcn/ui**：快速构建美观UI，组件可定制性强
5. **Vercel部署**：与Next.js深度集成，零配置部署，边缘网络加速

### 扩展路线

- **桌面端**：Tauri 2.0打包，复用React前端代码
- **移动端**：PWA优先，后期可考虑React Native
- **离线支持**：SQLite本地缓存 + Supabase实时同步
- **协作功能**：Supabase Realtime + CRDT（如Yjs）
