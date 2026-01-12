## 背景
目标是构建 NotebookLM 风格的研究工作台：用户上传文档，系统基于检索给出有引用的回答，并在三栏 UI 中展示来源、对话和输出。

## 目标 / 非目标
- 目标：
  - 单用户 MVP，支持 Notebook 管理、文档摄取（txt/markdown）、RAG 问答。
  - 回答包含引用片段，便于追溯。
  - 输出区支持“提炼”，且包含段落/要点/结构化三种格式。
  - 多语言场景以中文（简体）和英文为主，向量化模型需兼顾双语效果。
  - UI 仅提供中文文案，不实现国际化。
  - 使用 YAML 配置 + JSON Schema 生成，便于配置校验与编辑器补全。
  - 提供 OpenAPI JSON 与 Scalar UI 入口。
- 非目标：
  - 多人协作、权限管理、分享。
  - 音频/视频、思维导图导出、复杂工作流。
  - 分布式向量库或多服务编排。

## 决策
- 单后端服务（Python）+ 单前端应用（React + Tailwind）以降低复杂度。
- 文档与索引先使用本地存储 + 本地向量索引，后续再迁移到远端存储与向量库。
- ORM 采用 SQLAlchemy（而非 SQLModel），数据库访问基于 cl-* 公共库（计划复制到 backend/py/packages 并做必要脱敏）。
- 使用 cl-fastapix 集成 FastAPI 基础能力，并配合 cl-stdx enumx 在 OpenAPI schema 中显示 enum 值。
- HTTP 客户端采用 httpx；模型调用通过 OpenAI SDK + Ollama SDK。
- 数据库默认 SQLite（开发），生产环境目标 PostgreSQL（asyncpg）。
- 当前不提供 MySQL 管理器实现。
- 默认嵌入模型为 Ollama 的 bge-m3（可配置）。
- 默认聊天模型由 OpenAI SDK 调用（可配置）。
- 配置使用 pydantic-settings + YAML，提供配置管理器并自动生成 JSON Schema，支持 YAML 语言服务（# yaml-language-server: $schema=...）。
- OpenAPI JSON 路由为 `/v1/codev/openapi.json`，UI 路由为 `/v1/codev/openapi-ui/scaler`。

## 风险 / 权衡
- 仅支持 txt/markdown 会限制数据来源，但可降低解析复杂度与风险。
- 多语言向量化的效果依赖模型选择，需提供可配置的 embedding 模型。
- 复制 cl-* 公共库需脱敏并与当前项目 Python 版本对齐。

## 迁移方案
- MVP 期间存储在本地；后续将 Notebook/Source 元数据迁移到 PostgreSQL，并替换向量索引实现。

## 开放问题
- 右侧输出区是否需要支持多任务队列或历史记录？
- YAML Schema 的发布方式（本地文件路径 vs HTTP 提供）需要确认。
