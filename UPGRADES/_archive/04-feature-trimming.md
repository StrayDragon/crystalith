# 04 — 业务功能裁剪清单

> 逐项列出所有业务功能，标注复杂度/依赖/建议。**请 owner 在每项后标注 ✂️ 砍 / ⚠️ 简化 / ✅ 保留。**
> 末尾给出「建议 MVP 范围」供参考。

## A. 核心数据域（app 骨架）

| # | 功能 | 业务描述 | 复杂度/依赖 | 建议 |
|---|------|------|------|------|
| 1 | **Notebooks 笔记本** | 顶层容器，隔离资料与会话 | 低 | ⚠️ 可简化为单 notebook（砍多 notebook 切换/集合，见 openspec `multi-notebook-collections` 尚未实现） |
| 2 | **Sessions 会话** | notebook 内多轮对话会话 | 低 | ✅ 保留 |
| 3 | **Messages 消息** | 会话内问答记录 | 低 | ✅ 保留 |
| 4 | **Sources 资料**（核心实体） | 上传文件/URL 抓取 → 解析→分块→embedding→入库；含标签/去重/诊断 | **高** | ✅ 保留（子能力可裁，见下） |
| 5 | **Source Connectors 资料连接器** | Obsidian Vault / 本地目录批量同步导入 | 中（插件系统） | ⚠️ 本地目录对桌面 app 是天然能力，**内置即可**；Obsidian 可砍或后置 |

**Sources 子能力裁剪勾选**（按需）：

- [ ] 文件上传（txt/md/pdf）— 核心建议留
- [ ] URL 抓取 + 多 extractor（trafilatura/jina/firecrawl/browserless）— 砍到 **Jina + Firecrawl**，删 trafilatura/browserless
- [ ] 标签系统（tags + tag map）— 可砍，用文件夹/notebook 分组替代
- [ ] 资料去重（dedup_key）— 可砍或简化
- [ ] 资料诊断/失败处理（source_diagnostics）— 可简化
- [ ] OCR 兜底（扫描 PDF）— 可砍或后置
- [ ] 音视频转写（parser-media）— 可砍或后置

---

## B. AI 生成域（app 价值所在，按优先级）

| # | 功能 | 业务描述 | 复杂度 | 建议 |
|---|------|------|------|------|
| 6 | **QA 基础问答** | 朴素 RAG：提问→检索→回答+引用 | 中 | ✅ **必留**（核心闭环） |
| 7 | **Outputs 结构化生成** | 资料转 FAQ/指南/时间线/思维导图/测验/简报/幻灯片/段落/要点（10 种） | **高**（10 种 + 插件） | ⚠️ **重头裁剪点**：砍到 **3-4 种**（如 FAQ/BRIEFING/时间线），每种 output 是独立插件，删插件 = 删整个目录 |
| 8 | **Citations 引用溯源** | 生成结果高亮引用 + 点击跳转原文上下文 | 中 | ✅ 保留（RAG 差异化价值，体现"可信"） |
| 9 | **Studio/Slides 幻灯片工作室** | Slidev 集成，大纲编辑 + Markdown 流式生成幻灯片（8 端点） | **高** | ⚠️ 可砍或后置。Slidev 本身是 Node 工具迁移顺，但整个工作室 UI 复杂。**MVP 建议砍**，保留 output-SLIDES 基础生成 |
| 10 | **Refine 结果精炼** | 对已有 output/QA 批量改写、调风格 | 中 | ⚠️ 单条精炼留，batch 可砍 |
| 11 | **Research agentic 研究** | 多轮"搜索→分析→综合"自主研究 agent（13 端点 + graph + 依赖 SearXNG） | **极高** | ✂️ **建议 MVP 砍**。最复杂特性，依赖外部搜索服务，agent 图编排复杂。先做基础 RAG，研究模式作 v2 |
| 12 | **Analysis 资料分析** | 主题聚类 / 矛盾检测 / 相关性分析（跨资料洞察） | 中高 | ✂️ **建议 MVP 砍**。锦上添花，非核心闭环 |

---

## C. 配置/模板域（用户体验）

| # | 功能 | 业务描述 | 建议 |
|---|------|------|------|
| 13 | **Models 模型管理** | 列出可用模型/provider/角色；OpenAI/Ollama 配置 | ✅ 保留（砍 endpoint 自动发现 ~500 行，桌面 app 直接 localhost） |
| 14 | **Prompt Presets 提示词预设** | 快捷 `/命令` 触发的预设提示词 | ⚠️ 可与 Templates 合并简化 |
| 15 | **Templates 模板** | 保存复用的生成配置（含 Nunjucks 渲染） | ⚠️ 可与 Presets 合并成一个"预设"，砍模板渲染复杂度 |
| 16 | **Commands 命令面板** | `Ctrl+K` 命令面板 + `/` 触发器注册 | ⚠️ 前端命令面板 UI 保留，后端 registry 简化为静态 |

---

## D. 基础设施域（重写可大幅瘦身）

| # | 功能 | 建议 |
|---|------|------|
| 17 | **Tasks 后台任务队列** | ⚠️ 简化：单进程桌面 app 用 Bun 内置异步/Promise，砍独立 worker/queue |
| 18 | **UI state 服务端状态同步** | ✂️ 建议砍：桌面 app 前端 Zustand 自管，不需服务端 UI state echo |
| 19 | **Workspace 工具发现** | ⚠️ 简化为静态能力声明，砍动态 tool registry |
| 20 | **Plugins 插件系统**（17 个官方插件 + entry-points） | ✂️ **重头裁剪点**：Bun/桌面 app 不需 Python entry-points 动态发现。**保留逻辑内置成模块**，删整个插件框架（`shared/plugins/`、compliance、registry） |

---

## E. 非业务基础设施（强烈建议全砍）

支撑"多后端/多部署/server 化"的复杂度来源，桌面 app 不需要：

- ✂️ 4 个部署 profile（local/hybrid/docker/full）+ Procfile + overmind
- ✂️ 6 个 docker-compose overlay（storage/redis/searxng/ollama/slidev/host-remap）
- ✂️ 多数据库后端（Postgres）→ 只留 SQLite
- ✂️ 多向量库后端（chroma http/embedded/memory）→ 只留 sqlite-vec
- ✂️ 多缓存后端（redis）→ 内存/本地文件
- ✂️ 配置 overlay 分层 + secret.env 模板渲染 → 单个 JSON/TOML
- ✂️ endpoint_candidates 自动探测重排（~500 行）→ 静态 localhost
- ✂️ HTTP rate limit / guardrails / auth（面向公网 server）→ 桌面 app 本地访问不需要
- ✂️ SDK 多语言生成（Py/TS/Go/Rust + Fern + submodule）
- ✂️ SearXNG 集成（随 Research 砍）
- ✂️ openspec 70+ 历史 changes → 保留少数 canonical spec，重写即 reset

---

## 建议 MVP 范围（"砍到最小但仍有价值"）

> **单 notebook → 上传资料(PDF/MD/TXT + URL) → 解析分块入库 → RAG 问答(带引用) → 生成 3 种 output(FAQ/简报/时间线) → 历史会话**

**保留**：核心数据域 + QA + Citations + 模型管理 + 3 种 output
**砍掉**：Research、Analysis、Studio 工作室、多 notebook、标签系统、7 种 output、插件框架、SDK、多后端、多 profile

**估算**：核心后端从 48k 行 Python → **8-12k 行等价 TS**，前端复用大部分。

---

## 待 owner 决策

- [ ] ABCDE 五块逐项 ✂️/⚠️/✅
- [ ] 圈定 MVP 范围
- [ ] 分发方案 A（Tauri）还是 B（Bun 二进制 + 前端）
- [ ] 是否启动 P0 spike（PDF / 向量 / agent）
