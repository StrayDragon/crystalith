## 背景

### NotebookLM 产品定位
Google NotebookLM 是由 Google Labs 开发的 AI 驱动研究和写作助手，其前身是 2023 年 Google I/O 大会上首次公布的 "Project Tailwind" 项目。产品定位是 **"基于来源的 AI 研究助手与思维伙伴"**，核心价值在于将用户提供的资料作为知识的唯一来源，构建专注、深入且高度个性化的学习和研究环境。

### NotebookLM 核心技术特性
1. **Source-Grounding 机制**：确保 AI 的每一个回答都严格基于用户上传的文档，并附带内联引用（Inline Citations），清晰标注答案的每一句话来自哪篇文档、哪一页、哪一段。这种设计彻底解决了 AI 的"幻觉"问题。

2. **RAG 架构（检索增强生成）**：
   - 索引构建阶段：文档预处理、语义分割、向量化
   - 检索阶段：查询向量化、近似最近邻搜索、Top-K 结果获取
   - 上下文增强阶段：检索结果与原始查询融合
   - 生成阶段：LLM 基于增强上下文生成带引用的回答

3. **超长上下文窗口**：基于 Gemini 2.5 Pro 模型，支持最高 100 万甚至 200 万 Token 的上下文窗口，能够一次性"读完"并"理解"包含 50 篇学术论文的研究资料库。

4. **多模态内容处理**：
   - 文档类：PDF、TXT、Markdown
   - Google 系文件：Google 文档、Google 幻灯片
   - 音频文件：MP3（用于会议记录生成）
   - 网页类：网站、YouTube 视频（通过字幕提取内容）

5. **多模态内容生成**：
   - **音频概述（Audio Overview）**：生成两个 AI 主持人（一男一女）针对用户文档进行的"深度播客对话"，支持 80 种以上语言
   - **视频概述（Video Overview）**：自动抓取文档中的图片、图表，或生成关键的摘要幻灯片，配合语音生成视频
   - **结构化文档**：FAQ、学习指南、时间轴、简报、目录大纲、思维导图、测验试题、博客文章

6. **智能交互**：
   - 智能建议问题生成：当用户不知道该问什么时，系统自动生成推荐问题
   - 渐进式引导策略：采用苏格拉底式问答方法，引导用户深入理解主题
   - 跨文档关联分析：发现不同文档之间的微妙联系

### NotebookLM 设计哲学
- **"餐巾纸哲学"**：用最简单的方式解决最真实的问题
- **三栏界面**：左侧放置资料源，中间进行 AI 对话，右侧记录笔记
- **克制和专注**：一个笔记本处理特定的资料，不做"大一统的知识库"
- **"你的资料，你的答案"**：所有回答严格基于用户提供的来源

### Crystalith 当前实现状态
当前 Crystalith 已实现：
- Notebook 管理（CRUD）
- Source 上传（仅 txt/markdown）
- 文档分块与向量化（InMemoryVectorIndex，无持久化）
- RAG 问答（带引用）
- 提炼输出（paragraph/bullets/structured 三种格式）
- 三栏 UI 布局

需要重构以对齐 NotebookLM 能力。

## 目标 / 非目标

### 目标
- 构建可插拔的向量存储抽象层，支持持久化（解决重启数据丢失问题）
- 实现多格式文档解析器，支持 PDF、网页、音视频
- 引入会话管理，支持多轮对话和上下文窗口
- 扩展输出类型，支持 FAQ、学习指南、时间轴、思维导图、测验
- 实现音频概述生成（双人 AI 播客对话）
- 实现视频概述生成（幻灯片 + 语音）
- 实现智能建议问题生成
- 实现跨文档关联分析
- 重构前端工作流，优化用户体验

### 非目标
- 多人协作与权限管理（NotebookLM Business 功能）
- 分布式部署与水平扩展
- 实时协同编辑
- 移动端应用（NotebookLM 已有 Android/iOS 应用）
- 国际化（保持中文界面）

## 决策

### D1: 向量存储抽象
- **决策**：引入 `VectorStore` 抽象接口，支持多后端
- **原因**：当前 InMemoryVectorIndex 无法持久化，重启丢失数据。NotebookLM 使用持久化的键值存储和向量数据库。
- **实现**：
  - `VectorStore` Protocol 定义 add/search/remove 接口
  - `InMemoryVectorStore` 保留用于测试
  - `SQLiteVectorStore` 使用 sqlite-vss 扩展（开发环境）
  - `ChromaVectorStore` 可选，用于生产环境
- **替代方案**：直接使用 Chroma/Qdrant，但增加部署复杂度
- **参考**：NotebookLM 使用 KV Cache Offloading 技术，将中间状态存储在持久化的键值存储中

### D2: 文档解析器工厂
- **决策**：采用工厂模式，根据 MIME 类型选择解析器
- **原因**：NotebookLM 支持多种文档格式（PDF、Google Docs、音频、视频、网页），需要可扩展的解析器架构
- **实现**：
  - `Parser` Protocol 定义 parse 接口
  - `TextParser` 处理 txt/markdown
  - `PDFParser` 使用 pypdf 或 pdfplumber
  - `HTMLParser` 使用 beautifulsoup4
  - `AudioParser` 使用 Whisper API（NotebookLM 使用 Gemini 的语音识别技术）
  - `VideoParser` 提取音频后调用 AudioParser
- **替代方案**：使用 LangChain DocumentLoaders，但增加依赖

### D3: 会话管理模型
- **决策**：引入 `Session` 模型，独立于 Notebook
- **原因**：NotebookLM 支持多层次认知互动，从基础事实性问题到复杂分析性问题，需要会话上下文支持多轮对话
- **实现**：
  - `Session` 表：id, notebook_id, title, created_at, updated_at
  - `Message` 表：id, session_id, role, content, citations, created_at
  - 上下文窗口通过 Token 计数管理
- **替代方案**：在 Notebook 级别管理消息，但不支持多会话

### D4: 异步任务队列
- **决策**：使用内置任务队列，不引入 Celery
- **原因**：音频/视频生成是长时间运行的任务，需要异步处理。保持部署简单，MVP 阶段不需要分布式任务。
- **实现**：
  - `TaskQueue` 类管理任务状态
  - `Task` 模型：id, type, status, payload, result, created_at
  - 使用 asyncio 并发执行
- **替代方案**：使用 Celery + Redis，但增加部署复杂度
- **参考**：NotebookLM 的音频生成在推出多语言支持后两周内翻倍，需要可扩展的任务处理

### D5: 输出类型扩展
- **决策**：扩展 `OutputType` 枚举，引入生成器接口
- **原因**：NotebookLM 提供 8 种预设的内容模板（FAQ、学习指南、时间轴、简报、目录大纲、思维导图、测验试题、博客文章）
- **实现**：
  - `OutputType` 枚举：FAQ, GUIDE, TIMELINE, MINDMAP, QUIZ, BRIEFING
  - `OutputGenerator` Protocol 定义 generate 接口
  - 每种类型对应一个生成器实现
  - 使用 Prompt 模板驱动生成
- **替代方案**：硬编码生成逻辑，但不可扩展

### D6: 音频概述生成
- **决策**：使用 TTS API 生成双人对话音频
- **原因**：NotebookLM 的音频概述功能是产品的明星功能，贡献了 90% 的用户使用时长。它不是简单的文本朗读，而是生成两个 AI 主持人（一男一女）的"深度播客对话"。
- **实现**：
  - 生成对话脚本（两个角色交替：角色 A 负责提问和引导，角色 B 负责解答和补充）
  - 使用 OpenAI TTS 或 Edge TTS 生成语音
  - 合并音频片段，添加适当停顿
- **替代方案**：使用本地 TTS 模型，但质量较差

### D7: 视频概述生成
- **决策**：生成幻灯片 + 语音合成视频
- **原因**：NotebookLM 的视频概述是音频功能的"视觉进化版"，自动抓取文档中的图片、图表，或生成关键的摘要幻灯片
- **实现**：
  - 提取文档中的图片和关键点
  - 生成幻灯片（HTML → 图片）
  - 合成语音
  - 使用 FFmpeg 合成视频
- **替代方案**：使用视频生成 API，但成本高

### D8: 前端状态管理
- **决策**：重构为 Context + Reducer 模式
- **原因**：当前 WorkspacePage 状态过于复杂（800+ 行），难以维护。NotebookLM 的三栏界面设计解决了用户多工具切换的痛点，需要清晰的状态管理。
- **实现**：
  - `WorkspaceContext` 管理全局状态
  - `workspaceReducer` 处理状态更新
  - 拆分为独立的 hooks（useNotebooks, useSources, useChat, useRefine）
- **替代方案**：使用 Zustand/Redux，但增加依赖

## 风险 / 权衡

### R1: 向量存储迁移
- **风险**：从 InMemory 迁移到持久化存储可能丢失数据
- **缓解**：提供迁移脚本，支持导出/导入

### R2: 音频/视频生成成本
- **风险**：TTS 和视频生成可能产生较高 API 成本
- **缓解**：提供本地替代方案（Edge TTS 免费），支持配置切换

### R3: 多格式解析质量
- **风险**：PDF/音频解析质量可能不稳定
- **缓解**：提供解析状态反馈，支持手动修正

### R4: 前端重构范围
- **风险**：大规模重构可能引入回归
- **缓解**：保持组件接口稳定，增量重构

### R5: 上下文窗口限制
- **风险**：开源 LLM 的上下文窗口远小于 Gemini（100 万 Token）
- **缓解**：实现上下文压缩策略（摘要/截断），支持配置不同模型

## 迁移方案

### 阶段 1：基础设施（无 Breaking Change）
1. 新增 VectorStore 抽象层，InMemoryVectorIndex 实现接口
2. 新增 Parser 抽象层，现有解析逻辑迁移
3. 新增 Session/Message 模型
4. 新增 TaskQueue 模块

### 阶段 2：核心能力（部分 Breaking Change）
1. 迁移向量存储到 SQLite-VSS
2. 扩展 Source 模型支持多格式
3. 重构 QA API 支持会话
4. 新增 Suggestions API

### 阶段 3：输出扩展（API 新增）
1. 扩展 OutputType 枚举
2. 实现新的输出生成器
3. 新增音频/视频生成 API

### 阶段 4：前端整合（UI Breaking Change）
1. 重构 WorkspacePage 状态管理
2. 新增音频/视频播放组件
3. 新增建议问题面板

## 开放问题

1. **向量存储后端选择**：SQLite-VSS vs Chroma vs Qdrant？
   - 建议：MVP 使用 SQLite-VSS（与现有 SQLite 数据库一致），生产环境可选 Chroma

2. **TTS 服务选择**：OpenAI TTS vs Edge TTS vs 本地模型？
   - 建议：默认 Edge TTS（免费、质量可接受），可配置 OpenAI TTS（更自然）

3. **视频生成方案**：FFmpeg 本地合成 vs 云服务？
   - 建议：FFmpeg 本地合成，保持部署简单

4. **会话历史保留策略**：保留多久？多少条？
   - 建议：默认保留 30 天，可配置

5. **输出类型优先级**：哪些输出类型优先实现？
   - 建议：FAQ > 学习指南 > 时间轴 > 思维导图 > 测验（按实现复杂度排序）

6. **LLM 模型选择**：如何支持不同的 LLM 后端？
   - 建议：保持现有 Provider 抽象，支持 OpenAI/Ollama，后续可扩展 Anthropic/Google
