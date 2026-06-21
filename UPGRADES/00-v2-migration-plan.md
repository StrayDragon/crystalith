# 00 — Crystalith v2 全栈 TypeScript 迁移方案（最终版）

> **最终决策**（2026-07-02 确认）：
> 1. 全迁 Bun + TypeScript。Python 39k 行中无不可替代项
> 2. **所有 20+ 个 feature 全部保留**——research/analysis/studio/refine 等都是核心业务，不砍
> 3. AI runtime: `pi-ai`（provider）+ `pi-agent-core`（agent loop）+ AI SDK（结构化输出补充）
> 4. 产品定位: NotebookLM 启发的 Notebook RAG 平台——可集成、可验证、高效
> 5. RAG 策略可插拔（embed / keyword / 混合 / page-index / GraphRAG ...）
> 6. 内置 Eval Benchmark Harness，量化验收每个 RAG 策略
> 7. 外部服务（SearXNG/Chroma/Redis/Ollama）都可以自部署
> 8. Rivu 降级——删服务端状态机，v2 改为消息内嵌 JSON 渲染组件

---

## 一、目标架构

```
┌──────────────────────────────────────────────────────────────┐
│                    用户浏览器                                  │
│                   React 前端（复用，API 层换 eden）            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Sources  │  │  Chat    │  │ Research │  │  Studio    │  │
│  │ Panel    │  │ Panel    │  │ Panel    │  │ Panel      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐   │
│  │ Analysis │  │ Refine   │  │ Notebook / RAG Config    │   │
│  │ Panel    │  │ Panel    │  │ (策略选择 + Eval 面板)    │   │
│  └──────────┘  └──────────┘  └──────────────────────────┘   │
└──────────────────────┬───────────────────────────────────────┘
                       │ Elysia eden RPC（类型安全，零生成）
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Bun 单二进制 (crystalith-server)                 │
│              Elysia HTTP Server (Port 8032)                   │
│                                                              │
│  ┌─ AI 层 (pi-ai + pi-agent-core + AI SDK) ──────────────┐  │
│  │ Provider 抽象 → pi-ai (30+ provider + OAuth)           │  │
│  │ Agent Loop   → pi-agent-core (defineTool + event)      │  │
│  │ 结构化输出   → AI SDK generateObject(schema: Zod)      │  │
│  │ 流式生成     → AI SDK streamText / SSE relay          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ RAG 引擎 (可插拔策略) ────────────────────────────────┐  │
│  │ Embed RAG    → sqlite-vec (默认)                        │  │
│  │ Keyword RAG  → sqlite-fts5 BM25                        │  │
│  │ 混合检索     → Embed + BM25 + RRF                      │  │
│  │ Page Index   → 页面级索引                              │  │
│  │ GraphRAG     → 实体关系图 (P2)                         │  │
│  │ ...更多策略可插拔                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 业务层 (全部 feature 保留) ───────────────────────────┐  │
│  │ notebooks / sessions / messages / sources               │  │
│  │ qa / citations / outputs (全 7 种)                     │  │
│  │ research / analysis / studio / refine                  │  │
│  │ models / workspace / commands                          │  │
│  │ prompt_presets / templates / tasks                     │  │
│  │ source_connectors (Obsidian + 本地目录)                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Eval / Benchmark Harness (内置) ──────────────────────┐  │
│  │ Golden Dataset 管理 + 多策略 A/B 对比                  │  │
│  │ 指标: Faithfulness / Relevance / Recall / Latency     │  │
│  │ 前端质量面板可视化 + CLI harness                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 数据层 (Drizzle ORM → bun:sqlite) ───────────────────┐  │
│  │ 全部 17 表 → Drizzle schema                           │  │
│  │ sqlite-vec 扩展 (向量同库，零依赖)                      │  │
│  │ sqlite-fts5 (BM25 可选)                                │  │
│  │ 新增: rag_strategies / eval_datasets / eval_runs      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 内容处理管线 ────────────────────────────────────────┐  │
│  │ PDF → unpdf (pdf.js)         HTML → cheerio/readability │
│  │ Web 抓取 → Playwright + Jina + Firecrawl               │  │
│  │ 音视频转写 → OpenAI Whisper API                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ 可选 Server Mode ────────────────────────────────────┐  │
│  │ JWT 认证 / Rate Limiting / Postgres 适配 / S3 存储     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈选型（Final）

| 角色 | 选型 | 理由 |
|------|------|------|
| Runtime + 打包 | **Bun** | 单二进制、bun:sqlite 内置、原生 TS |
| Web Framework | **Elysia** | eden RPC 干掉 OpenAPI 生成、端到端类型推断 |
| ORM | **Drizzle ORM** | bun-sqlite 原生驱动、类型安全 |
| Provider 抽象 | **`@earendil-works/pi-ai`** | 30+ provider + OAuth 订阅 + models.json 静态配置 |
| Agent Loop | **`@earendil-works/pi-agent-core`** | defineTool + event stream + 通用 agent runtime |
| 结构化输出 | **`ai` (Vercel AI SDK)** | generateObject(schema: Zod)、pi-ai 做 provider 层 |
| 流式生成 | **AI SDK streamText** | ReadableStream 原生 SSE relay |
| Token 计数 | **`gpt-tokenizer`** | 纯 JS、无 wasm |
| 向量存储 | **sqlite-vec** | 同库零依赖、已 benchmark（10k chunk 8ms） |
| Schema 校验 | **Zod**（前后端共享） | 前端已在用 |
| PDF 解析 | **unpdf** (pdf.js) | 已 benchmark 验证通过（中文/文本提取一致） |
| HTML 解析 | **cheerio + @mozilla/readability** | jQuery 风格 + Firefox Reader Mode |
| Web 抓取 | **Playwright + Jina Reader + Firecrawl** | Playwright Node 主场 |
| 模板渲染 | **Nunjucks** | 前端已在用、jinja2 近语法 |
| 日志 | **consola** | unjs 生态、Bun 友好 |
| 桌面分发 | **Tauri v2 + Bun sidecar**（后置） | 单二进制先用 |

---

## 三、RAG 引擎设计（核心差异化）

### 3.1 策略注册表

```typescript
// rag/strategy-registry.ts
interface RAGStrategy {
  id: string;
  name: string;
  description: string;
  version: string;
  index(sources: Source[], options?: IndexOptions): Promise<IndexResult>;
  retrieve(query: string, options?: RetrieveOptions): Promise<RetrievedContext[]>;
  isIndexed(notebookId: number): Promise<boolean>;
  configSchema?: z.ZodTypeAny;
}

class RAGRegistry {
  private strategies = new Map<string, RAGStrategy>();
  register(strategy: RAGStrategy): void;
  get(id: string): RAGStrategy | undefined;
  list(): RAGStrategy[];
  async apply(notebookId: number, strategyIds: string[]): Promise<void>;
}
```

### 3.2 策略路线图

| 策略 | 优先级 | 方案 | 预估 |
|------|-------|------|------|
| **Embed RAG** | P0 | sqlite-vec 向量检索 + chunk embedding | ~500 行 |
| **Keyword RAG** | P0 | sqlite-fts5 BM25 全文检索 | ~200 行 |
| **混合检索** | P1 | Embed + BM25 + RRF 融合排序 | ~300 行 |
| **Page Index** | P1 | 按页面索引 + 页面级检索 + 预览 | ~400 行 |
| **GraphRAG** | P2 | 实体/关系抽取 → 图构建 → 图遍历 | ~1,500 行 |
| **HyDE** | P2 | 假设文档嵌入检索 | ~200 行 |
| **Self-RAG** | P2 | 自反思检索 + 相关性判断 | ~800 行 |

### 3.3 检索管线

```
用户提问
   │
   ▼
查询理解（Query Rewriting / Decomposition）
   │
   ▼
多策略并行检索
   ├─ Embed RAG → sqlite-vec → Top K
   ├─ Keyword  → sqlite-fts5  → Top K
   └─ Page Idx → 页面级      → chunks
   │
   ▼
融合排序（RRF / 加权重排 / Cross-encoder Rerank）
   │
   ▼
上下文组装 → prompt + 引用标记 → pi-agent-core agent → 流式输出
```

---

## 四、Eval / Benchmark Harness

### 4.1 架构

```
Golden Dataset Manager
├─ 数据集导入（JSON/CSV/手动标注）
├─ 版本管理
└─ 格式: {question, expected_answer, source_docs, criteria}

Eval Runner
├─ 多策略并行评测
├─ 指标收集
│   ├─ Faithfulness / Answer Relevance / Context Recall
│   ├─ Context Precision / Latency / Token Cost
│   └─ 自定义指标
└─ 结果持久化（eval_runs 表）

Metrics Calculator
├─ LLM-as-Judge（pi-ai 调模型打分）
└─ 字符串匹配 + ROUGE/BLEU（可选）

前端质量面板
├─ 策略对比雷达图
├─ 逐 QA 对详情
├─ 历史趋势
└─ 回归检测
```

### 4.2 优先级

| # | 功能 | 优先级 | 预估 |
|---|------|-------|------|
| K1 | Golden Dataset 管理 | P1 | ~300 行 |
| K2 | Eval Runner | P1 | ~400 行 |
| K3 | Metrics 计算 (LLM-as-Judge) | P1 | ~500 行 |
| K4 | 前端质量面板 | P2 | ~600 行 |
| K5 | 回归检测 | P2 | ~200 行 |
| K6 | CLI harness | P1 | ~200 行 |

---

## 五、Rivu 降级方案

> 当前 Rivu: POST → 服务端状态机(UiV1EventProcessor) → STATE_DELTA 返回 → 前端渲染
> v2 方案: AI 消息返回时直接内嵌组件描述 JSON → 前端解析直接渲染

```typescript
// v2: 消息内嵌组件（不经过服务端状态机）
interface AIMessage {
  text: string;
  citations: Citation[];
  components?: UIMount[];   // 直接嵌在消息里！
}

// 前端渲染
{message.components?.map(c => (
  <DynamicComponent type={c.type} props={c.props} />
))}
```

pi-agent-core 的 tool calling 可以定义 `mount_ui_component` tool，AI 自主决定何时推送图表/表格/交互组件到消息中。

---

## 六、数据模型（Drizzle Schema）

```typescript
// 核心业务表（从 Python 17 表映射）
notebooks              // 笔记本
notebook_extractor_policies
sessions               // 会话
messages               // 消息
sources                // 资料
source_connector_bindings
chunks                 // 分块
source_tags / source_tag_map
outputs                // 结构化输出
studio_slides          // 幻灯片草稿
research_sessions      // 研究会话
research_steps         // 研究步骤
tasks                  // 后台任务
templates              // 模板
prompt_presets         // 提示词预设

// RAG 策略表（新增）
rag_strategies         // 策略注册（id, name, version, config_schema）
strategy_configs       // notebook 级策略配置
strategy_indexes       // 策略索引状态

// Eval 表（新增）
eval_datasets          // Golden 数据集
eval_dataset_items     // 单条 QA
eval_runs              // 评测运行记录
eval_run_items         // 单条评测结果
eval_metrics           // 汇总指标

// 配置表
model_configs          // 模型配置（pi-ai models.json DB 镜像）
system_config          // 系统配置 KV

// 删除的表（vs Python）
// ✂️ ui_event_receipts — Rivu 降级后不再需要
```

---

## 七、迁移路线图

### Phase 0 — 脚手架（Week 1-2）

```
□ Bun + Elysia 项目初始化（server/ 目录）
□ Drizzle ORM schema 定义（所有表）
□ DB migration 工具链（Drizzle Kit）
□ pi-ai 集成（models.json → ModelRegistry）
□ pi-agent-core agent 骨架（defineTool + event stream）
□ Zod schema 层（前后端共享）
□ 前端 Elysia eden 客户端接入（src/api/v2/）
□ 开发环境热重载（Bun --watch + Vite HMR）
□ Vitest 测试骨架
```

**Gate**：Elysia + Drizzle + pi-ai 三件套跑通，前端 eden 调通。

### Phase 1 — 核心闭环 MVP（Week 3-6）

```
□ notebooks / sessions / messages CRUD
□ sources 管理（上传、解析、列表、详情、搜索）
□ Embed RAG 策略（sqlite-vec）
□ QA 问答（pi-agent-core + RAG tools + 流式输出）
□ Citations 引用溯源（chunk → source 跳转）
□ 7 种 Outputs 生成（AI SDK generateObject）
□ models 模型管理（pi-ai 配置界面）
□ 前端 API 层切换（eden treaty 替换 openapi-ts）
```

**Gate**：全链路跑通 — 上传 PDF → 解析 → 问答 → 引用溯源。

### Phase 2 — 完整业务迁移（Week 7-12）

```
□ research — 自主研究 Agent（pi-agent-core + SearXNG tool）
□ analysis — 资料分析（聚类 + 矛盾 + 相关性）
□ studio — 幻灯片工作室
□ refine — 结果精炼
□ workspace / commands — 工具注册表 + 命令面板
□ source_connectors — Obsidian + 本地目录同步
□ prompt_presets / templates — 提示词 + 模板
□ tasks — 后台任务队列
□ Keyword RAG + 混合检索策略
□ RAG Registry 注册表模式
```

**Gate**：Python 94 个端点有对应 v2 实现，行为对比通过。

### Phase 3 — Eval + 质量体系（Week 13-16）

```
□ K1–K3 Eval Dataset + Runner + Metrics
□ K6 CLI harness
□ 策略 A/B 对比报告
□ K4 前端质量面板
□ K5 回归检测
□ Rivu 降级实现（消息内嵌组件渲染）
```

**Gate**：至少 2 个策略完成 benchmark 对比，质量面板可用。

### Phase 4 — 体验 + 分发（Week 17-20）

```
□ 前端体验优化（加载/错误/空态）
□ 导出功能（Markdown + 引用）
□ 性能优化（chunk 批量、并发控制）
□ 错误处理标准化 + 日志
□ bun build --compile 单二进制
□ Server Mode 可选层（JWT + Postgres + 限流）
□ Page Index 策略
□ 行为对比全量通过
```

**Gate**：单二进制构建成功，Eval 回归检测通过。

### Phase 5 — 清理交付（Week 21+）

```
□ 行为对比全量通过（所有端点）
□ 前端完全切换到 v2 API
□ 删除 backend/py/
□ 删除 frontend/web/src/api/generated/
□ GraphRAG / HyDE / Self-RAG 策略（P2）
□ Tauri 桌面包装（可选）
□ CI/CD + 自动更新
□ Git tag v2.0.0
```

---

## 八、预估工作量

| 阶段 | 新写 TS | 前端适配 | 净变化 |
|------|--------|---------|--------|
| Phase 0 脚手架 | +1,500 | +100 | +1,600 |
| Phase 1 核心闭环 | +4,000 | +200 | +4,200 |
| Phase 2 完整业务 | +5,000 | +500 | +5,500 |
| Phase 3 Eval | +1,600 | +600 | +2,200 |
| Phase 4 体验+分发 | +1,500 | +300 | +1,800 |
| Phase 5 清理 | -39,000 (Python) | -200 (旧 API) | -39,200 |

**最终**: 39k Python + 26k React → **~14k TS + ~27k React = 41k 总行**，功能更完整（多了 RAG 策略注册表 + Eval）。

---

## 九、风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| pi-ai/pi-agent-core 版本迭代 | 🟡 中 | 锁定版本、薄封装隔离 |
| research agent 迁移（pydantic-graph → pi-agent-core） | 🟡 中 | pydantic-graph 图结构可映射为 pi tool 链 |
| studio Slidev 集成 | 🟡 中 | Slidev 本身是 Node 工具，Bun 环境可运行 |
| 前端大量适配 | 🟡 中 | 只换 API 客户端层，组件逻辑不动 |
| sqlite-vec 规模上限 | 🟢 低 | 个人/小团队 < 10万 chunk，超了平迁 LanceDB |
| 行为回归 | 🟡 中 | Eval harness 作为回归检测，逐模块 diff 验证 |

---

## 十、关键文档索引

| 文档 | 用途 |
|------|------|
| `UPGRADES/00-cleanup-python.md` | ⚡ **执行中** — 前置清理方案（删除胶水代码） |
| `UPGRADES/00-dev-guide.md` | 本地热重载开发环境 |
| `UPGRADES/01-current-state-audit.md` | 现状盘点 |
| `UPGRADES/02-target-stack-bun.md` | Bun 技术栈 |
| `UPGRADES/03-ai-ecosystem-mapping.md` | AI 生态对照表 |
| `UPGRADES/06-pi-runtime-integration.md` | pi-ai + pi-agent-core 集成方案 |
| `UPGRADES/07-sqlite-vec-benchmark.md` | sqlite-vec benchmark 数据 |
| `UPGRADES/08-web-framework-elysia-vs-hono.md` | Elysia vs Hono 选型 |
| `UPGRADES/09-pdf-benchmark.md` | PDF 解析 benchmark |
| `UPGRADES/10-tauri-sidecar-packaging.md` | Tauri 分发架构 |
| `UPGRADES/11-drizzle-schema-design.md` | Drizzle schema 设计参考 |
