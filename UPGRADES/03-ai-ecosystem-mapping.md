# 03 — AI 生态对照表（Python → TypeScript）

> 本文件是重写的**核心调研产出**。针对当前项目实际使用的 AI 相关 Python 包，逐一给出较新的、活跃维护的 TS 对应包、迁移映射、差异说明和难度评级。

## 一览总表

| Python 现状（本仓库实际使用） | TS 目标（推荐） | 备选 | 迁移难度 |
|---|---|---|---|
| **pydantic-ai**（`Agent` / 结构化生成 / 工具调用） | **Vercel AI SDK** (`ai`) | LlamaIndex.TS | ⚠️ 中 |
| **pydantic-graph**（`Graph` / `BaseNode` 工作流） | **自建轻量 runner**（首选） / XState / `@langchain/langgraph` | Inngest | ⚠️ 中 |
| **langchain-community**（仅 SearxSearchWrapper 一处） | **直接 fetch**（SearXNG 即 HTTP JSON API） | — | ✅ 易 |
| **openai** SDK | **openai** 官方 JS SDK | — | ✅ 易 |
| **ollama** SDK | **ollai-js** / AI SDK 的 `@ai-sdk/ollama` provider | — | ✅ 易 |
| **tiktoken**（token 计数） | **gpt-tokenizer** | `tiktoken` (wasm) | ✅ 易 |
| **pydantic**（schema 校验/模型） | **Zod**（前端已在用） | Elysia 内建 / Valibot | ✅ 易 |
| **chromadb**（向量库） | **sqlite-vec**（bun:sqlite 扩展） | LanceDB / Qdrant JS client | ⚠️ 中 |
| **pypdf**（PDF 解析） | **unpdf** / pdfjs-dist | — | 🔴 **须 spike** |
| **beautifulsoup4 + lxml**（HTML） | **linkedom** / cheerio | — | ✅ 易 |
| **trafilatura / jina / firecrawl / browserless**（Web 抓取） | **Jina Reader + Firecrawl JS SDK**（砍 trafilatura/browserless） | Playwright 兜底 | ⚠️ 中 |
| **jinja2**（模板渲染） | **Nunjucks**（前端已在用） | Handlebars | ✅ 易 |
| **structlog**（结构化日志） | **consola** / pino / `@csplogger` | — | ✅ 易 |
| **SQLAlchemy + alembic** | **Drizzle ORM + Drizzle Kit** | Kysely | ⚠️ 中 |
| **FastAPI** | **Elysia** / Hono | — | ⚠️ 中 |

---

## 详细对照

### 1. pydantic-ai → Vercel AI SDK (`ai`)

**当前用法**（本仓库 `shared/agents/`、`features/qa|outputs|research|studio`）：

```python
agent = Agent(
    model,                          # build_chat_model(...)
    output_type=StructuredSchema,   # Pydantic schema → 结构化 JSON 输出
    deps_type=StudioDeps,
    system_prompt="...",
)
result = await agent.run(user_prompt, deps=deps)
result.data  # 结构化输出
```

**TS 对应 — Vercel AI SDK**（`ai` + `@ai-sdk/openai` 等 provider 包）：

```typescript
import { generateObject, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const { object } = await generateObject({
  model: openai("gpt-4o"),
  schema: structuredSchema,         // Zod schema → 结构化输出（等价 output_type）
  system: "...",
  prompt: userPrompt,
  // 工具调用
  tools: {
    search: tool({
      description: "...",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => { /* ... */ },
    }),
  },
});
```

| 能力 | pydantic-ai | AI SDK | 说明 |
|------|-------------|--------|------|
| 结构化输出 | `output_type=PydanticModel` | `generateObject({ schema: Zod })` | ✅ 对等 |
| 流式 | `agent.iter()` / `stream` | `streamObject` / `streamText` | ✅ AI SDK 流式 API 更成熟 |
| 工具调用 | `@agent.tool` / `tools=[...]` | `tool({ ... execute })` | ✅ 对等 |
| 依赖注入 | `deps_type` + `RunContext[Deps]` | 闭包 / React context（前端） | ⚠️ 需自管，但 TS 里闭包更自然 |
| 多 provider | `Model` 接口 + factory | `@ai-sdk/*` 系列 | ✅ AI SDK 生态更广（含 ollama/anthropic/google/mistral/...） |
| 模型设置 | `ModelSettings` (temp/max_tokens) | `{ temperature, maxTokens }` 直传 | ✅ 对等 |
| 重试 | pydantic-ai retry policy | 自管 / `experimental_telemetry` | ⚠️ 需补 |
| 可观测 | `instrument` | `experimental_telemetry` + OpenTelemetry | ✅ 对等 |

**迁移要点**：
- 当前 `build_chat_model()` factory → 替换为按 provider 选 `@ai-sdk/*` 的 model 实例
- `output_type` Pydantic schema → 逐个翻译成 Zod schema（机械工作）
- `deps_type` 注入 → 用闭包/模块级单例替代（TS 无需类型化 DI）
- 工具函数的 `RunContext` 参数 → 改为闭包捕获

**难度**：⚠️ 中。模式对等，主要是 schema 翻译和 factory 改写。

**重要替代方案**：[pi-agent-core](./06-pi-runtime-integration.md) 提供更完整的 agent runtime（含 agent loop / tool 调度 / 状态管理），且自身即 Bun-built。**对话式 RAG 场景优先考虑 pi**，需要直接 `generateObject(schema)` 的纯结构化输出场景用 AI SDK。两者可混用（pi-ai 做 provider + AI SDK 做 generateObject）。详见 [06](./06-pi-runtime-integration.md)。

**备选：LlamaIndex.TS**—— 更偏 RAG 框架，但本项目 RAG 逻辑已自建，用不上那么多抽象。

---

### 2. pydantic-graph → 自建轻量 runner / XState / LangGraph.js

**当前用法**（本仓库 3 个 Graph）：

```python
class ResolveContext(BaseNode[OutputGraphState, StudioDeps, Output]):
    async def run(self, ctx: GraphRunContext[...]) -> type[GenerateOutput]:
        # ...
        return GenerateOutput()

OUTPUT_GRAPH = Graph(nodes=[...])
result = await OUTPUT_GRAPH.run(ResolveContext(), state=state, deps=deps)
```

三个图：
- **OUTPUT_GRAPH**（`shared/agents/output_graph.py`，832 行）：ResolveContext → GenerateOutput → MapCitations → PostprocessOutput → PersistOutput
- **SEARCH_GRAPH**（`shared/agents/search_graph.py`，149 行）：生成摘要
- **RESEARCH_GRAPH**（`features/research/graph.py`，13 端点）：PlanSearches → ExecuteSearches → AnalyzeResults → WaitForApproval → GenerateReport（多轮循环）

**TS 对应方案对比**：

| 方案 | 适用 | 优点 | 缺点 |
|------|------|------|------|
| **① 自建轻量 runner**（~100 行） | 全部 | 贴合现有语义、零依赖、完全可控 | 要自己写状态机 + 类型 |
| **② XState v5** | 全部 | 成熟状态机库、可视化、持久化可恢复 | 学习曲线、非 AI 专用 |
| **③ `@langchain/langgraph`** | Research（若保留） | 与 pydantic-graph 语义最像、自带 checkpointing | 引入 LangChain 依赖、过重 |

**推荐**：
- 若 **Research 砍掉**（见 [04](./04-feature-trimming.md) 建议）→ 剩余 Output/Search 图都很线性 → **① 自建轻量 runner** 最干净。pydantic-graph 本身很薄，BaseNode + `run(ctx)` 返回下一节点的模式，用 ~100 行 TS 即可复刻：

  ```typescript
  type Node<S, R> = (ctx: { state: S; deps: StudioDeps }) => Promise<Node<S, R> | { __end: R } | null>;
  async function runGraph<S, R>(start: Node<S,R>, init: S, deps: StudioDeps): Promise<R> {
    let node = start, state = init;
    while (true) {
      const next = await node({ state, deps });
      if (next && "__end" in next) return next.__end;
      if (!next) throw new Error("node returned null");
      node = next;
    }
  }
  ```

- 若 **Research 保留** → ③ `@langchain/langgraph`（带 checkpointing 的复杂多轮图，重写成本高，直接用现成的更稳）

**难度**：⚠️ 中（砍 Research 后为 ✅ 易）。

---

### 3. langchain-community → 直接 fetch

**当前用法**：仅 `shared/search/__init__.py` 一处，用 `SearxSearchWrapper` 调 SearXNG。

**真相**：SearXNG 本身就是 HTTP JSON API（`/search?q=...&format=json`）。`SearxSearchWrapper` 只是个 HTTP wrapper + 字段映射（`link`/`snippet`/`engines`）。

**TS 对应**：直接 `fetch()`，~30 行替代。**不需要任何框架**。例：

```typescript
const resp = await fetch(`${searxngHost}/search?q=${encodeURIComponent(q)}&format=json`);
const data = await resp.json();
const results = data.results.map((r: any) => ({
  title: r.title, url: r.url ?? r.link, snippet: r.content, engine: r.engines?.[0],
}));
```

**难度**：✅ 易。**（且若 Research 砍掉，整块搜索都不需要了）**

---

### 4. openai / ollama SDK

| Python | TS | 备注 |
|--------|----|----|
| `openai` SDK（含 Whisper 转写） | `openai` 官方 JS SDK（`import OpenAI from "openai"`） | API 几乎一一对应，含 `audio.transcriptions.create` |
| `ollama` SDK | **优先**：AI SDK 的 `@ai-sdk/ollama` provider（直接进 AI SDK 调用链）<br>**备选**：`ollama` JS SDK | 若用 AI SDK 统一调，ollama 作为 provider 最省事 |

**难度**：✅ 易。

---

### 5. tiktoken → gpt-tokenizer

**当前用法**（`shared/context/counter.py`）：`tiktoken.encoding_for_model(model).encode(text)` 做 token 计数和截断，用于 context window 管理。

**TS 对应**：

| 包 | 类型 | 体积 | 维护 | 备注 |
|----|------|------|------|------|
| **`gpt-tokenizer`**（推荐） | 纯 JS | 小 | 活跃 | 无 wasm，开箱即用，覆盖 o200k_base/cl100k_base |
| `tiktoken`（wasm） | wasm | 中 | 活跃 | OpenAI 官方，需加载 wasm |
| `@dqbd/tiktoken` | wasm | — | 较旧 | 已迁移到上面的官方 |

```typescript
import { encode } from "gpt-tokenizer"; // 默认 cl100k_base
const count = (text: string) => encode(text).length;
```

**难度**：✅ 易。

---

### 6. pydantic → Zod

**当前用法**：所有 `BaseModel`（schema、config、API 入参出参）。

**TS 对应**：**Zod**（前端 `package.json` 已依赖 `zod@^4`）。

| pydantic | Zod |
|----------|-----|
| `class Foo(BaseModel): x: int` | `z.object({ x: z.number() })` |
| `Field(default=..., description=...)` | `z.number().default(...).describe(...)` |
| `model_dump()` / `model_validate()` | `.parse()` / `.parseAsync()` |
| `ConfigDict(extra="forbid")` | `.strict()` |
| 枚举 + 元信息（`MetaInfoStrEnum`） | `z.enum([...])` + 单独的元信息 map |

**收益**：前后端**共享 schema**（同一个 `z.object` 文件前后端 import），干掉 OpenAPI 生成链路的部分价值。

**难度**：✅ 易（机械翻译）。

---

### 7. chromadb → sqlite-vec

**当前用法**（`shared/vector_storage/`）：
- `add(notebook_id, source_id, chunk_ids, vectors)` 存向量 + 元数据
- `search(notebook_id, query_vector, top_k, filter)` 余弦相似检索
- 三后端：PersistentClient / HttpClient / memory
- 上层 `cached.py` 做缓存层（361 行）

**TS 对应方案对比**：

| 方案 | 类型 | 依赖 | 适用规模 | 备注 |
|------|------|------|---------|------|
| **sqlite-vec**（推荐） | SQLite 扩展 | bun:sqlite + `sqlite-vec` npm | < 10 万 chunk | **业务库 + 向量同库**，零外部依赖，桌面 app 最佳 |
| LanceDB | native TS | `@lancedb/lancedb` | 任意 | 列存向量库，性能强，多一个文件 |
| Qdrant | 独立 server | `@qdrant/js-client` | 任意 | 回到"外部服务"，违背初衷 |
| Chroma JS client | 独立 server | `chromadb` npm | 任意 | 同上 |

```typescript
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
const db = new Database("app.db");
sqliteVec.load(db);
db.run("CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[1024])");
// 插入 / 检索：db.prepare("INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)").run(...)
// db.prepare("SELECT rowid, distance FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance LIMIT ?")
```

**迁移要点**：
- 当前 `cached.py` 缓存层逻辑（epoch-based 失效）保留，只换底层 store 实现
- 余弦相似：sqlite-vec 用 distance，需注意归一化
- **规模确认**：sqlite-vec 是暴力扫描（非 ANN），个人 notebook 资料 < 10 万 chunk 完全够

**难度**：⚠️ 中（主要是缓存层逻辑要照搬）。

---

### 8. pypdf → unpdf（⚠️ 头号风险）

**当前用法**（`shared/parsers/pdf.py`）：`PdfReader(BytesIO(content)).pages[i].extract_text()`，按页分块。

**TS 对应**：

| 包 | 基于 | 质量 | 备注 |
|----|------|------|------|
| **unpdf** | pdf.js (Mozilla) | 中等 | unjs 生态，API 简洁（`extractText(buf)`） |
| **pdfjs-dist** | pdf.js (Mozilla) | 中等 | 原始底层，控制力强，配置多 |
| pdf-parse | — | 较低 | 维护一般 |

**风险**：PDF 文本提取质量对样本敏感。pypdf（基于 pdfminer）和 pdf.js 引擎不同，**复杂排版/扫描版/特殊字体**提取结果可能差异显著。

**⚡ 必须最先 spike**：拉 10-20 个真实样本（用户的 PDF 资料）跑 unpdf vs pypdf 对比文本质量、页码准确性、中文支持。**这是整个重写方案唯一的 go/no-go 点。**

**降级方案**：若 unpdf 质量不足，可 ① 用 Tauri 的 Rust 侧调 `pdf-extract` crate；② 保留 Python PDF 服务作为可选 sidecar（破坏单一二进制，最后手段）。

**难度**：🔴 须验证。

---

### 9. beautifulsoup4 + lxml → linkedom / cheerio

**当前用法**（`crystalith-parser-html` 插件）：HTML 清洗 + 正文提取。

**TS 对应**：
- **linkedom**（推荐）：更接近 DOM 标准 API，无原生依赖
- **cheerio**：jQuery 风格，生态广，`load(html)` 后 CSS 选择器

**难度**：✅ 易。

---

### 10. Web 抓取 extractor 动物园 → 精简

**当前**：trafilatura / jina / firecrawl / browserless 四个 extractor（插件）。

**TS 对应**：

| Extractor | TS 方案 | 建议 |
|-----------|---------|------|
| **trafilatura**（Python-only，正文提取） | 无直接对等 → **砍掉** | ✂️ |
| **jina** | Jina Reader HTTP API（`https://r.jina.ai/{url}`）→ 直接 fetch | ✅ 保留 |
| **firecrawl** | `firecrawl` 官方 JS SDK | ✅ 保留 |
| **browserless**（playwright 渲染） | **Playwright Node 原生**（无需 browserless 服务） | ✅ 保留（直接用 Playwright） |

**结果**：从 4 个砍到 3 个，且去掉 browserless 这个独立服务依赖（改用 Playwright 库）。

**难度**：⚠️ 中。

---

### 11. jinja2 → Nunjucks

**当前用法**：output 模板渲染、config 模板渲染（`{{ secret.VAR }}` / `{{ env.VAR }}`）。

**TS 对应**：**Nunjucks**（前端 `package.json` 已依赖）。语法与 jinja2 几乎一致，模板可直接迁移。

**难度**：✅ 易。

---

### 12. structlog → consola / pino

**当前**：`cl-logs`（封装 structlog），结构化日志 + 结构化 error kind 分类（`observability.py`）。

**TS 对应**：
- **consola**（unjs 生态）：API 友好，与 Bun 搭配自然
- **pino**：高性能，结构化 JSON 日志
- 保留 error kind 分类逻辑（`classify_error_kind`）作为业务层

**难度**：✅ 易。

---

### 13. SQLAlchemy + alembic → Drizzle ORM + Drizzle Kit

**当前**：17 张表，SQLAlchemy 异步模型 + 11 个 alembic 迁移，双数据库方言（Postgres/SQLite）。

**TS 对应**：
- **Drizzle ORM**：schema-first，TS 类型推断一流，原生 `drizzle-orm/bun-sqlite` 驱动
- **Drizzle Kit**：迁移生成（`drizzle-kit generate` / `migrate`）

**迁移要点**：
- 桌面 app 只需 SQLite（砍掉 Postgres 方言）→ schema 更简单
- alembic 迁移历史**不迁移**，重写即重置（生成初始 schema → 后续 Drizzle Kit 管理）
- 17 张表逐个翻译成 Drizzle schema（机械工作）

**难度**：⚠️ 中（量大但机械）。

---

### 14. FastAPI → Elysia / Hono

**当前**：FastAPI + cl-fastapix（封装），18 个 feature router，94 端点，OpenAPI 自动生成。

**TS 对应**：

| 框架 | 类型安全 | RPC 客户端 | OpenAPI | 备注 |
|------|---------|-----------|---------|------|
| **Elysia** | 端到端推断（最强） | `@elysiajs/eden`（类型安全 RPC，免生成） | 内建 | 可**干掉 OpenAPI 生成链路** |
| **Hono** | 良好（Zod 集成） | `hono/client` | 插件 | 更稳、生态广，牺牲部分推断 |

**迁移要点**：
- 当前 `features/*/api.py` 的 router 模式 → Elysia/Hono 的 `.get()/.post()` 几乎一一对应
- Pydantic 入参校验 → Zod / Elysia 内建 schema
- FastAPI 依赖注入（`Depends`）→ 闭包 / 模块级工厂
- OpenAPI 自动生成 → 若用 Elysia eden 客户端，前端类型直接推断，**可干掉 `@hey-api/openapi-ts` 整条链路**

**难度**：⚠️ 中。

---

## 与 pi 生态的关系

除本表列出的通用 TS 包外，**pi 生态**（`pi-ai` / `pi-agent-core` / pi SDK）是一组自身即 Bun-built 的独立 npm 包，可同时覆盖「provider 抽象」（替代 `shared/ai/`）和「agent runtime」（替代 pydantic-ai 的 agent loop）两层，是比 AI SDK 更完整的 runtime 选项。**详见 [06-pi-runtime-integration.md](./06-pi-runtime-integration.md)。**

---

## 迁移风险矩阵

| 风险 | 严重度 | 应对 |
|------|--------|------|
| **PDF 解析质量**（unpdf vs pypdf） | 🔴🔴🔴 致命 | **P0 spike**，真实样本对比 |
| RAG 召回效果（sqlite-vec 暴力扫描） | 🟡 中 | 确认 notebook 规模 < 10 万 chunk |
| AI SDK 结构化输出稳定性 | 🟢 低 | 模式成熟，与 pydantic-ai 对等 |
| 工作流编排（若保留 Research） | 🟡 中 | 用 `@langchain/langgraph` 兜底 |
| 音视频转写/OCR | 🟢 低 | 都是调 API，迁移直接 |
| Bun 个别原生模块兼容 | 🟢 低 | 主流库已验证 |

## 结论

**AI 生态层面，重写无不可逾越的 gap。** 唯一致命风险在 PDF 解析（与语言无关，是引擎差异），须 P0 验证。其余映射均有成熟对等物，且 Zod/Nunjucks 前端已用，可前后端共享。
