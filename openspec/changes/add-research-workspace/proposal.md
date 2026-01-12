# 变更：研究型工作台首版能力

## 为什么
我们需要一个清晰、可落地的首版范围：支持基于私有文档的检索与对话，并以三栏工作台展示输入、聊天与输出，同时为后续深度研究能力打基础。

## 变更内容
- 增加 Notebook 管理与基础聊天流（左来源/引用、中聊天、右输出）。
- 文档仅支持 txt/markdown，完成上传、解析、分块与向量化。
- Provider 层支持 OpenAI 与 Ollama 官方 SDK（不依赖 LiteLLM）。
- 嵌入使用 Ollama（默认 bge-m3），对话使用 OpenAI。
- 引入基于 YAML 的项目配置（pydantic-settings 校验 + JSON Schema 生成）。
- 数据库默认 SQLite，预留 PostgreSQL 作为远端部署目标，并使用 cl-* SQLAlchemy 基础库。
- 引入 cl-fastapix 并使用 scalar-fastapi 提供 OpenAPI UI。
- 输出形态 MVP 仅支持“提炼”，提供段落/要点/结构化三种格式。

## 影响范围
- 受影响的 specs：notebook-management, source-ingestion, rag-qa, ai-provider-config, workspace-ui, refine-output, config-management, data-access, openapi-docs
- 受影响代码：backend/py（API、索引、向量检索、配置管理、数据库访问）、frontend/web（MVP UI）
