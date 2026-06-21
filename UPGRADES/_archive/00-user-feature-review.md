# 00 — 用户视角功能全景与裁剪决策表

> 从用户实际使用界面出发，逐功能梳理。每项请标注 ✅ 保留 / ⚠️ 简化 / ✂️ 砍掉（MVP 后置）。
> 标注完成后，关联的代码模块就有了裁剪依据。

---

## 🌐 产品整体结构（用户看到的）

```
Crystalith 是一个单页面工作区 App，桌面端 3 个可拖拽面板，移动端 3 个 Tab：

┌────────────┐  ┌────────────┐  ┌────────────┐
│  📁 来源    │  │  💬 聊天    │  │  📝 笔记    │
│  Sources   │  │  Chat      │  │  Studio    │
└────────────┘  └────────────┘  └────────────┘

顶部栏：Notebook 切换 / 健康诊断 / 系统配置 / 快捷键帮助
全局快捷键：Ctrl+K 命令面板 / Ctrl+1/2/3 切换面板 / Ctrl+Enter 发送
```

用户打开 App 的核心旅程：
```
选 Notebook → 导入资料(上传/URL) → 资料入库解析 → 基于资料做以下事情：

  A. 问答（Chat 面板）     ← 🟢 核心闭环
  B. 结构化生成（Studio）  ← 🟡 增值能力
  C. 自主研究（Research）  ← 🔴 最复杂
  D. 知识图谱（Analysis）  ← 🟠 可视化
  E. 幻灯片（Slides）      ← 🟠 专项工具
  F. 结果精炼（Refine）    ← 🟡 辅助
```

---

## 📋 逐功能 Review

### 🔵 功能区 A：资料管理（用户旅程的起点）

| # | 用户看到的 | 用户能做什么 | 前端代码 | 后端代码 | 状态 |
|---|---------|-----------|---------|---------|------|
| A1 | **Notebook 笔记本** | 创建/删除/重命名/切换笔记本，作为顶层资料隔离容器 | `domains/notebooks/` (1,055 行) | `notebooks/` (257 行，5 端点) | [ ] |
| A2 | **本地上传资料** | 拖拽/点击上传 PDF/MD/TXT，自动解析→分块→入库 | `domains/sources/SourcesPanel` | `sources/` (2,867 行) + `parsers/` | [ ] |
| A3 | **URL 抓取资料** | 输入 URL，选择抓取方式（Jina/Firecrawl/trafilatura/browserless） | `overlays/AddSourceFromUrlDialog` | `sources/` + extractors | [ ] |
| A4 | **批量同步目录** | Obsidian Vault / 本地文件夹批量导入 | `SourceConnectorsDialog` (1,071 行) | `source_connectors/` (1,272 行，6 端点) | [ ] |
| A5 | **资料列表/搜索/排序** | 浏览所有资料，搜索过滤，排序，标签筛选 | `SourcesPanelView` (1,646 行) | `sources/api_sources.py` | [ ] |
| A6 | **资料详情** | 查看资料内容，高亮引用来源 | `SourceDetailDialog` (914 行) | `sources/` endpoints | [ ] |
| A7 | **标签系统** | 给资料打标签/按标签过滤 | `sources/` tag hooks | `sources/api_tags.py` | ✂️ 建议砍 |
| A8 | **资料去重** | dedup_key 检测重复上传 | — | `sources/service.py` | ✂️ 建议砍 |
| A9 | **资料诊断** | 查看资料解析状态/失败原因 | `DiagnosticsDialog` | `shared/source_diagnostics.py` | ⚠️ 简化 |
| A10 | **搜索结果队列** | 搜索结果排队管理，选择并入资料库 | `SearchResultsQueue` (768 行) | `sources/` search | [ ] |

**A 区关键问题**（请勾选）：
- [ ] 多 Notebook 真的需要吗？还是单 Notebook 够了？
- [ ] URL 抓取保留几个 extractor？建议砍到 Jina + Firecrawl 两个
- [ ] 标签系统用不上可以砍，靠 folder/notebook 自然分组
- [ ] 资料去重、诊断这些是"工程完备性"而非"用户价值"，可简化

---

### 🟢 功能区 B：RAG 问答（核心闭环）

| # | 用户看到的 | 用户能做什么 | 前端代码 | 后端代码 | 状态 |
|---|---------|-----------|---------|---------|------|
| B1 | **聊天面板** | 在聊天框提问，AI 基于选中的资料回答 | `ChatPanel` (725 行) + `useChat` (662 行) | `qa/service.py` (1,482 行，3 端点) | ✅ **必留** |
| B2 | **引用溯源** | 回答中高亮引用，点击跳转到原文位置 | `citations/` (4 个组件) | `citations/` (136 行，1 端点) | ✅ **必留** |
| B3 | **流式生成** | 实时流式显示 AI 回答 | `useChat` streaming | `qa/service.py` SSE | ✅ **必留** |
| B4 | **会话管理** | 创建/切换/删除/重命名会话，历史回看 | `sessions/` (706 行) + `SessionSwitcher` | `sessions/` (678 行，7 端点) | ✅ **必留** |
| B5 | **消息历史** | 查看历史消息，分页加载 | `useChat` loadMore | `messages/` (216 行，2 端点) | ✅ **必留** |
| B6 | **导出会话** | 导出 Markdown/JSON（含引用） | `evidenceExport.ts` | QA export endpoints | ⚠️ 保留 Markdown，砍 JSON |

**B 区关键问题**：
- [ ] 这都是核心闭环，建议全部保留，只做瘦身不做裁剪

---

### 🟡 功能区 C：结构化生成（Outputs / Studio 笔记面板）

当前有 **7 种** output 类型 + 各种 Viewer 组件：

| # | 类型 | 用户看到的 | 前端 Viewer | 后端 Generator | 使用频率 | 决策 |
|---|------|---------|-----------|---------------|---------|------|
| C1 | **FAQ 闪卡** | 问答卡片，正反面翻转 | `FlashcardViewer` | `outputs/generators/faq.py` | [ ] | [ ] |
| C2 | **BRIEFING 报告** | 结构化报告：背景/发现/建议/下一步 | `ReportViewer` | `outputs/generators/briefing.py` | [ ] | [ ] |
| C3 | **TIMELINE 时间轴** | 关键事件序列可视化 | `TimelineViewer` | `outputs/generators/timeline.py` | [ ] | [ ] |
| C4 | **GUIDE 指南** | 学习/行动清单（带勾选） | `GuideChecklist` | `outputs/generators/guide.py` | [ ] | [ ] |
| C5 | **MINDMAP 思维导图** | 主题层级结构可视化 | `MindmapViewer` | `outputs/generators/mindmap.py` | [ ] | [ ] |
| C6 | **QUIZ 测验** | 选择题测验交互 | `QuizRunner` | `outputs/generators/quiz.py` | [ ] | [ ] |
| C7 | **SLIDES 演示** | Slidev 演示文稿大纲+Markdown | `StudioOutputViewer` | `outputs/generators/slides.py` | [ ] | [ ] |

**Outputs 整体前端**：`domains/outputs/` (4,086 行) + `domains/refine/` (2,231 行) + `domains/studio/` (3,594 行) = **~9,900 行前端**
**Outputs 后端**：`outputs/` (1,023 行，6 端点) + `refine/` (321 行) + `studio/` (1,686 行) = **~3,000 行后端**

| # | 用户看到的（流程相关） | 功能 | 前端 | 后端 | 状态 |
|---|-----------------|------|------|------|------|
| C8 | **生成配置** | 选择 output 类型 → 调数量/难度/主题 → 生成 | `OutputTypeSelector` | `outputs/service.py` | [ ] |
| C9 | **Output 查看器** | 全屏/弹窗查看生成的 output | `OutputContent` + Viewer 组件 | — | [ ] |
| C10 | **生成队列** | 查看生成队列，重试/取消 | `StudioOutputsList` | `tasks/` + output jobs | [ ] |
| C11 | **Refine 精炼** | 对已有的 output/QA 调风格、改写 | `RefinePanel` (1,160 行) | `refine/` (2 端点) | ✂️ 建议砍（MVP） |
| C12 | **模板系统** | 保存/加载 prompt 模板 | `templates/` (1,030 行) | `templates/` (444 行，6 端点) | ⚠️ 建议简化 |

**C 区关键问题**：
- [ ] 7 种 output 你真正需要哪几个？建议 MVP 只保留 3 种
- [ ] Refine 精炼的使用频率如何？大多数用户会"直接重新生成"而非"精炼"
- [ ] 模板系统在"桌面 app"场景是否过于复杂？静态预设够用吗？

---

### 🔴 功能区 D：Research 自主研究（最复杂的模块）

| # | 用户看到的 | 功能 | 前端 | 后端 | 状态 |
|---|---------|------|------|------|------|
| D1 | **Research 研究胶囊** | 输入研究课题 → 自动多轮"搜索→分析→综合" | `ResearchCapsule` | `research/graph.py` | ✂️ 建议砍（MVP） |
| D2 | **研究详情** | 查看研究过程、中间结果、引用 | `ResearchDetailPanel` (1,616 行) | — | ✂️ |
| D3 | **研究导出** | 导出研究成果 | `ResearchExportDialog` | — | ✂️ |

> **全模块**：前端 2,992 行 + 后端 2,834 行（13 端点）+ **依赖 SearXNG**（外部搜索服务）
> **这是最复杂的模块**，而且依赖外部搜索服务，与"本地优先"理念冲突。
> **MVP 强烈建议砍掉**。

| [ ] | ✂️ 砍掉 Research 全部（MVP 后置） |

---

### 🟠 功能区 E：Analysis 分析 + 知识图谱

| # | 用户看到的 | 功能 | 前端 | 后端 | 状态 |
|---|---------|------|------|------|------|
| E1 | **Analysis 分析面板** | 分析资料库：主题聚类 / 矛盾检测 / 相关性 | `AnalysisPanel` | `analysis/` (427 行，1 端点) | ✂️ 建议砍（MVP） |
| E2 | **知识图谱** | 可视化展示（但疑似废弃？） | `KnowledgeGraphView` (1,183 行) | — | ✂️ |

> 前端 1,836 行的 Analysis 和 KnowledgeGraphView 看起来是半成品 / 实验功能。
> **MVP 建议砍掉**。

| [ ] | ✂️ 砍掉 Analysis（MVP 后置） |

---

### 🟠 功能区 F：Slides 幻灯片工作室

| # | 用户看到的 | 功能 | 前端 | 后端 | 状态 |
|---|---------|------|------|------|------|
| F1 | **Slides Studio** | 大纲编辑 + Markdown 流式生成 + Slidev 预览 | `SlidesStudioDialog` (1,900 行！) | `studio/` (1,686 行，8 端点) | ✂️ 建议砍（MVP） |
| F2 | **Studio 工具网格** | 选择 output 工具列表 | `StudioToolsGrid` | — | ⚠️ 与 C 区有重叠 |
| F3 | **Studio Output 列表** | Studio 面板的 output 列表 | `StudioOutputsList` | — | ⚠️ 与 C 区有重叠 |

> Slides Studio 是整个前端最重的单一组件（1,900 行），后端 8 端点 + Slidev 集成。
> **MVP 建议砍掉**。基础 SLIDES output（在 C 区）可以考虑保留。

| [ ] | ✂️ 砍掉 Slides Studio（MVP 后置） |

---

### ⚙️ 功能区 G：系统配置和工具

| # | 功能 | 描述 | 前端 | 后端 | 状态 |
|---|------|------|------|------|------|
| G1 | **模型管理** | 配置 OpenAI/Ollama 模型，切换 provider | `SystemConfigDialog` | `models/` (2 端点) | ⚠️ 简化 |
| G2 | **健康诊断** | 看各依赖健康状态 | `DiagnosticsDialog` | `shared/observability.py` + health probes | ⚠️ 简化 |
| G3 | **命令面板** | Ctrl+K 全局命令搜索 | `CommandPalette` | `commands/` (1 端点) | ✅ 保留 |
| G4 | **快捷键帮助** | 查看所有快捷键 | `ShortcutHelpPanel` | — | ✅ 保留 |
| G5 | **Prompt 预设** | `/` 命令触发预设提示词 | — | `prompt_presets/` (4 端点) | ⚠️ 合并到模板 |

---

### 🏗️ 功能区 H：基础设施（不可见但占代码量）

| # | 组件 | 当前状态 | 行数 | 建议 |
|---|------|---------|------|------|
| H1 | **多数据库后端** | Postgres + SQLite 双后端抽象 | ~3,000 (shared/db) | ✂️ 只留 SQLite |
| H2 | **多向量后端** | Chroma embedded/http/memory 三模式 | ~2,500 (shared/vector_storage) | ✂️ 只留 sqlite-vec（或内嵌 Chroma） |
| H3 | **多缓存后端** | Redis + 内存 | ~800 (shared/cache) | ✂️ 只留内存 |
| H4 | **Endpoint 自动发现** | 自动探测 Ollama/Chroma/Redis/Postgres | ~1,700 (endpoint_candidates + ollama_discovery + factory) | ✂️ 全砍，静态配置 |
| H5 | **插件系统** | Python entry-points + 17 个官方插件 | ~2,500 (shared/plugins) | ✂️ 砍框架，核心逻辑内置 |
| H6 | **后台任务队列** | 独立 worker/queue | 595 (tasks/) | ⚠️ 简化，单进程 async |
| H7 | **HTTP 限流/认证** | rate_limit + auth 中间件 | ~400 (web/) | ✂️ 本地不需要 |
| H8 | **多部署 profile** | 4 个 profile × 6 个 overlay + overmind | Docker Compose 矩阵 | ✂️ 全砍 |
| H9 | **SDK 多语言生成** | Fern + submodule + Py/TS/Go/Rust | 额外脚本 | ✂️ 全砍 |

> **H 区合计**：~14,000 行（占后端 36%）— 纯粹是"server 化"的代价。

| [ ] | 全砍，桌面 app 不需要这些 |
H1–H9 建议全部 ✂️。

---

## 📊 裁剪前后对比（预估）

| | 当前 | 裁剪后（所有 ✂️ 执行） | 裁剪后（只砍 H 区） |
|---|------|----------------------|-------------------|
| 后端代码 | ~39,000 行 | ~10,000 行 | ~25,000 行 |
| 前端代码 | ~26,000 行 | ~18,000 行 | ~24,000 行 |
| 后端端点 | 94 个 | ~35 个 | ~70 个 |
| 外部依赖 | Postgres/Chroma/Redis/SearXNG/Slidev | SQLite + Ollama/OpenAI | SQLite + Chroma(emb) + 可选 |

---

## 🎯 建议 MVP 定义

> **单 notebook → 上传资料(PDF/MD/TXT + URL) → 解析分块入库 → RAG 问答(带引用) → 生成 3 种 output → 历史会话**

```
✅ 保留清单：
  A1–A6  资料管理（单 notebook + 文件上传 + URL 抓取 + 列表/详情/搜索）
  B1–B6  RAG 问答 + 引用溯源 + 会话管理 + 流式生成
  C1–C3  Outputs: FAQ + 简报 + 时间轴（3 种）
  G3–G4  命令面板 + 快捷键帮助
  G1     模型管理（简化：去自动发现，静态 localhost）
  C10    生成队列（简化：单进程）

✂️ 砍掉清单（MVP 不包含）：
  D1–D3  Research 自主研究（整个砍，~5,100 总行）
  E1–E2  Analysis + 知识图谱（~2,200 总行）
  F1–F3  Slides Studio（~3,600 总行）
  C4–C7  Guide/Mindmap/Quiz/Slides output
  C11    Refine 精炼
  C12    模板系统
  A7–A8  标签系统 / 去重
  A4    批量同步目录

⚠️ 简化清单（保留但瘦身）：
  A9    资料诊断 → 简单错误提示
  A3    URL 抓取 → 只保留 Jina + Firecrawl
  A10   搜索结果队列 → 内联到 sources 列表
  G2    健康诊断 → 只检查 LLM + embedding
  G5    提示词预设 → 与模型配置合并
```

---

## 📝 Owner 决策区

请逐项标注：

### A 区（资料管理）
- [ ] A1 多 Notebook → ⚠️ 简化（或保留单 notebook？
- [ ] A2 本地上传 → ✅
- [ ] A3 URL 抓取 → ⚠️ 简化为 2 个 extractor？
- [ ] A4 批量同步 → ✂️？
- [ ] A5 资料列表/搜索 → ✅
- [ ] A6 资料详情 → ✅
- [ ] A7 标签系统 → ✂️？
- [ ] A8 去重 → ✂️？
- [ ] A9 诊断 → ⚠️ 简化？
- [ ] A10 搜索队列 → ⚠️ 简化？

### B 区（RAG 问答）
- [ ] B1–B6 全部 → ✅

### C 区（Outputs）
- [ ] C1 FAQ → ✅？
- [ ] C2 简报 → ✅？
- [ ] C3 时间轴 → ✅？
- [ ] C4 指南 → ✂️？
- [ ] C5 思维导图 → ✂️？
- [ ] C6 测验 → ✂️？
- [ ] C7 Slides → ✂️（保留 SLIDES output 但裁掉 Studio？
- [ ] C11 Refine → ✂️？
- [ ] C12 模板 → ⚠️？

### D 区（Research）
- [ ] D1–D3 全部 → ✂️？

### E 区（Analysis）
- [ ] E1–E2 全部 → ✂️？

### F 区（Slides Studio）
- [ ] F1–F3 全部 → ✂️？

### G 区（配置/工具）
- [ ] G1 模型管理 → ⚠️ 简化
- [ ] G2 健康诊断 → ⚠️ 简化
- [ ] G3 命令面板 → ✅
- [ ] G4 快捷键 → ✅
- [ ] G5 预设 → ⚠️ 合并

### H 区（基础设施）
- [ ] H1–H9 多后端抽象/插件/部署复杂度 → ✂️ 全砍
