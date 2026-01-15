# 变更：NotebookLM 架构重构

## 为什么

Crystalith 的目标是成为 Google NotebookLM 的开源实现。NotebookLM 是由 Google Labs 开发的 AI 驱动研究和写作助手，其核心价值在于：

1. **Source-Grounding 机制**：严格基于用户上传的文档回答问题，每个答案都附带内联引用，彻底解决 AI 幻觉问题
2. **多模态处理**：支持 PDF、音频、视频、网页等多种格式
3. **多模态输出**：音频概述（双人 AI 播客对话）、视频概述、结构化文档（FAQ/学习指南/时间轴/思维导图/测验）
4. **智能交互**：建议问题生成、苏格拉底式引导、跨文档关联分析

当前 Crystalith 实现了基础的 RAG 问答和提炼功能，但与 NotebookLM 的核心能力存在显著差距：

| 能力 | NotebookLM | Crystalith 当前 |
|------|------------|-----------------|
| 向量存储 | 持久化存储 | 内存存储，重启丢失 |
| 文档格式 | PDF/音频/视频/网页 | 仅 txt/markdown |
| 会话管理 | 多轮对话+上下文窗口 | 单次问答 |
| 输出类型 | 8 种结构化输出 | 3 种提炼格式 |
| 音频概述 | 双人播客对话 | 无 |
| 视频概述 | 幻灯片+语音 | 无 |
| 智能建议 | 自动生成建议问题 | 无 |
| 跨文档分析 | 关联检测+主题聚类 | 无 |

本提案旨在将 Crystalith 重构为功能完整的 NotebookLM 开源实现，采用原子化、可并行的模块设计，支持多人/多 Agent 协作开发。

## 变更内容

### 第一层：基础设施层（**BREAKING**）

这一层提供核心基础设施，4 个模块可完全并行开发：

- **vector-storage**：向量存储抽象层
  - `VectorStore` Protocol 定义标准接口
  - 支持 InMemory（测试）、SQLite-VSS（开发）、Chroma（生产）后端
  - 解决当前重启数据丢失问题

- **document-parser**：多格式文档解析器
  - `Parser` Protocol + 工厂模式
  - 支持 txt/markdown/PDF/HTML/音频/视频
  - 异步解析 + 状态跟踪

- **session-management**：会话历史管理
  - `Session` + `Message` 模型
  - 支持多轮对话和上下文窗口
  - 会话标题自动生成

- **task-queue**：异步任务队列
  - `Task` 模型 + `TaskQueue` 类
  - 支持长时间运行的生成任务（音频/视频）
  - 任务状态追踪和优先级队列

### 第二层：核心能力层

这一层构建核心 AI 能力，依赖第一层，内部可并行：

- **source-grounding**：来源锚定机制增强
  - 精确到段落/页码的引用定位
  - 来源验证和无证据检测
  - 置信度评分

- **cross-document-analysis**：跨文档关联分析
  - 多源关联检测
  - 主题聚类
  - 矛盾检测

- **smart-suggestions**：智能建议问题生成
  - 基于文档内容的问题生成
  - 上下文感知建议
  - 苏格拉底式深度引导

- **context-window**：长上下文窗口管理
  - Token 计数（tiktoken）
  - 上下文压缩策略（摘要/截断）
  - 滑动窗口管理

### 第三层：输出生成层

这一层扩展输出能力，依赖第二层，内部可并行：

- **structured-outputs**：扩展输出类型（**完整实现**）
  - FAQ：问答对提取
  - GUIDE：学习指南生成
  - TIMELINE：时间轴提取
  - MINDMAP：思维导图生成
  - QUIZ：测验题生成
  - BRIEFING：执行简报生成

- **audio-overview**：音频概述生成（**仅接口预留，暂不实现**）
  - 定义 API 接口和数据模型
  - 前端预留 UI 入口（禁用状态）
  - 后端返回 501 Not Implemented

- **video-overview**：视频概述生成（**仅接口预留，暂不实现**）
  - 定义 API 接口和数据模型
  - 前端预留 UI 入口（禁用状态）
  - 后端返回 501 Not Implemented

### 第四层：用户体验层（**BREAKING**）

这一层整合所有功能，优化用户体验：

- **workspace-flow**：工作流重构
  - Context + Reducer 状态管理
  - 优化输入→对话→输出流程
  - 会话切换和输出类型选择

- **citation-interaction**：引用交互增强
  - 悬停预览（Tooltip）
  - 跳转到原文（高亮定位）
  - 多选操作栏

## 影响范围

### 受影响的 specs
- workspace-ui（重构为 workspace-flow）
- source-ingestion（扩展为 document-parser）
- rag-qa（增强为 source-grounding）
- refine-output（扩展为 structured-outputs）
- 新增 9 个 specs：vector-storage, session-management, task-queue, cross-document-analysis, smart-suggestions, context-window, audio-overview, video-overview, citation-interaction

### 受影响代码

**backend/py**：
- `vector_index.py` → 重构为 `vector_storage/` 模块
- `ingestion/` → 扩展为 `parsers/` 模块
- `api/qa.py` → 增加会话管理
- `api/refine.py` → 扩展输出类型
- 新增 `audio/`、`video/` 模块
- 新增 `tasks/` 模块

**frontend/web**：
- `WorkspacePage.tsx` → 重构状态管理（拆分为 Context + hooks）
- 新增 `AudioPlayer`、`VideoPlayer` 组件
- 新增 `SuggestionPanel` 组件
- 新增 `OutputTypeSelector` 组件
- 新增 `SessionSwitcher` 组件

### 数据库变更
- 新增 `sessions` 表（id, notebook_id, title, created_at, updated_at）
- 新增 `messages` 表（id, session_id, role, content, citations, created_at）
- 新增 `tasks` 表（id, type, status, payload, result, created_at, updated_at）
- 新增 `outputs` 表（id, notebook_id, type, content, created_at）
- `sources` 表增加 `parser_type`、`metadata` 字段
- 向量索引持久化表（sqlite-vss）

### API 变更（**BREAKING**）
- 新增 `/v1/notebooks/{id}/sessions` 端点（会话管理）
- 新增 `/v1/sessions/{id}/messages` 端点（消息管理）
- 新增 `/v1/notebooks/{id}/outputs` 端点（输出管理）
- 新增 `/v1/notebooks/{id}/suggestions` 端点（建议问题）
- 新增 `/v1/notebooks/{id}/analysis` 端点（跨文档分析）
- 新增 `/v1/notebooks/{id}/audio-overview` 端点（音频概述）
- 新增 `/v1/notebooks/{id}/video-overview` 端点（视频概述）
- 新增 `/v1/tasks/{id}` 端点（任务状态）
- 修改 `/v1/notebooks/{id}/qa` 支持会话上下文（可选 session_id 参数）

## 并行化与流水线化

### 任务分配建议

**Phase 0（Week 1-2）- 4 个 Agent 完全并行**：
- Agent A: vector-storage
- Agent B: document-parser
- Agent C: session-management
- Agent D: task-queue

**Phase 1（Week 3-4）- 4 个 Agent 部分并行**：
- Agent A: source-grounding（依赖 P0.1, P0.2）
- Agent B: cross-document-analysis（依赖 P0.1）
- Agent C: smart-suggestions（依赖 P0.3）
- Agent D: context-window（依赖 P0.1）

**Phase 2（Week 5-6）- 3 个 Agent 部分并行**：
- Agent A: structured-outputs（依赖 P1.1）
- Agent B: audio-overview（依赖 P1.1, P0.4）
- Agent C: video-overview（依赖 P2.2）

**Phase 3（Week 7-8）- 顺序整合**：
- 全员: workspace-flow, citation-interaction, E2E 测试

### 关键路径
```
P0.1 向量存储 → P1.1 来源锚定 → P2.1 结构化输出 → P3.1 工作流重构
```

这条路径决定了整体进度，其他任务可并行推进。

---

## 技能要求

### 前端技能要求

实现前端任务时，必须遵循以下技能指南：

1. **UI/UX Pro Max** (`ui-ux-pro-max`)
   - 使用 Tailwind CSS 进行样式开发
   - 遵循响应式设计原则（320px, 768px, 1024px, 1440px）
   - 使用 SVG 图标（Heroicons/Lucide），禁止使用 emoji 作为图标
   - 所有可点击元素添加 `cursor-pointer`
   - 悬停状态使用颜色/透明度过渡，避免 scale 导致布局偏移
   - 确保 Light/Dark 模式对比度符合 WCAG 标准

2. **Vercel React Best Practices** (`vercel-react-best-practices`)
   - 优先消除数据请求瀑布流（使用 Promise.all）
   - 使用 `next/dynamic` 或 React.lazy 进行代码分割
   - 使用 SWR 进行客户端数据获取和去重
   - 避免不必要的重渲染（useMemo, useCallback）
   - 使用 Suspense 边界进行流式渲染

3. **Web Interface Guidelines** (`web-design-guidelines`)
   - 所有图片必须有 alt 文本
   - 表单输入必须有 label
   - 颜色不能是唯一的状态指示器
   - 尊重 `prefers-reduced-motion` 设置
   - 键盘导航必须可用

### 后端技能要求

实现后端任务时，必须遵循以下技能指南：

1. **uv Python 项目管理** (`uv`)
   - 使用 `uv sync` 管理依赖
   - 使用 `uv run` 执行命令
   - 遵循 workspace 结构（backend/py/packages/）

2. **Python 测试** (`python-testing`)
   - 使用 pytest + pytest-asyncio
   - 测试文件命名 `test_*.py`
   - 覆盖核心业务逻辑

3. **Python 日志** (`python-logging`)
   - 使用 cl-logs 包进行日志记录
   - 结构化日志输出

4. **Ruff 代码质量** (`ruff`)
   - 使用 ruff 进行代码检查和格式化
   - 遵循项目 pyproject.toml 配置

5. **API 设计规范**
   - 使用 FastAPI + Pydantic
   - RESTful API 设计
   - OpenAPI 文档自动生成
   - 使用 cl-fastapix 增强功能
