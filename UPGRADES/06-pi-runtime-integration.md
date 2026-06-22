# 06 — pi 包作为 Agent 运行时（专题）

> 调研结论：**pi 生态极其契合本项目**。pi 本身就是 Bun 构建的（`bun build --compile` 出二进制），且底层 `pi-ai` / `pi-agent-core` 是**独立发布的通用 npm 包**，正好对应 crystalith 重写后需要的「LLM provider 抽象」和「agent 运行时」两层。
>
> 本文档补充 [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md)：在 Vercel AI SDK 之外，pi 包是更"完整"的 agent runtime 选项。

## 一、pi 生态分层

pi 是 monorepo（`pi-mono`），分四层，**每层都是独立 npm 包**：

| 包 | 定位 | 描述 | 对 crystalith 的意义 |
|----|------|------|------|
| **`@earendil-works/pi-ai`** | LLM provider 抽象 | "Unified LLM API with automatic model discovery and provider configuration" | ★ 直接替代 `shared/ai/`（factory + openai/ollama provider + config/models） |
| **`@earendil-works/pi-agent-core`** | **通用** agent 核心 | "**General-purpose agent** with transport abstraction, state management, and attachment support" | ★ 替代 `shared/agents/` 的 agent loop（注意：通用，非 coding-specific） |
| **`@earendil-works/pi-coding-agent`** | harness 层 + SDK | session/settings/resource 管理 + coding 工具 + `createAgentSession()` 工厂 | 可选：完整 agent session（compaction/retry/事件流/session 分支树） |
| `@earendil-works/pi-tui` | 终端 UI | ink-based TUI | 与本项目无关（crystalith 有自己的 React UI） |

**关键事实**：
- 三层都独立发布到 npm（各自有完整 `package.json` + `dist`），可单独 `npm install`。
- pi 自己的二进制就是 `bun build --compile ./dist/bun/cli.js` 出来的 —— **整个 pi 栈在 Bun runtime 下是生产验证过的**，与本项目目标 runtime 零冲突。
- `pi-ai` 按 provider 拆子路径导出（`pi-ai/anthropic`、`pi-ai/openai`、...），按需引入。

## 二、pi-ai ↔ crystalith `shared/ai/` 映射

`pi-ai` 开箱支持 **30+ provider**（OpenAI / Anthropic / Gemini / DeepSeek / Ollama / Groq / Mistral / xAI / OpenRouter / Bedrock / Vertex / Cloudflare / Azure / ...），这远超 crystalith 现有的 OpenAI+Ollama。

| crystalith 现状（Python） | pi-ai 对应 |
|------|------|
| `shared/ai/factory.py`（376 行 provider 工厂） | `getModel(provider, id)` + `ModelRegistry` |
| `shared/ai/openai_provider.py` + `ollama_provider.py` | `pi-ai/openai` 等子路径；Ollama 经 `models.json` 配成 `openai-completions` provider |
| `shared/config/models.py`（1090 行模型配置） | `ModelRegistry.create(authStorage)` + `models.json` 自定义模型 |
| `shared/config/ollama_discovery.py`（340 行端点探测） | ✂️ **直接砍掉**，桌面 app 配 `localhost:11434` 即可 |
| `shared/config/endpoint_candidates.py`（170 行） | ✂️ 同上 |
| `shared/ai/openai_client_manager.py` | `AuthStorage`（API key 解析：env / auth.json / OAuth / 命令） |
| `shared/ai/retry.py`（233 行重试策略） | SDK 自带 retry（`SettingsManager` 配 `retry.maxRetries`） |
| `shared/ai/effective_settings.py`（模型设置映射） | model 配置 + thinkingLevelMap |

**Ollama 配置示例**（`models.json`，桌面 app 极简）：
```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": { "supportsDeveloperRole": false, "supportsReasoningEffort": false },
      "models": [{ "id": "qwen2.5:7b" }, { "id": "bge-m3" }]
    }
  }
}
```

**收益**：砍掉 crystalith `shared/ai/` + `shared/config/` 的端点探测/多 provider 胶水约 **2000+ 行**，换成 pi-ai 的声明式配置。

## 三、Agent 运行时：三种集成深度

crystalith 的 agent 需求分两类，要分别对待：
- **对话式 RAG**（QA、Research）—— 天然适合 pi 的 agent loop
- **生成流水线**（pydantic-graph 的 Output/Search 图，多节点状态机）—— 见下「重构思路」

### 方案 P1 — 只用 `pi-ai`，agent 自建（最轻）

```
pi-ai (provider/model)  +  自建 agent loop（或 Vercel AI SDK）
```
- 只拿 pi-ai 做 provider 抽象，agent loop 自己写或用 AI SDK
- **优点**：最薄依赖、最灵活、无 pi session 格式假设
- **缺点**：compaction / retry / 事件流 / 持久化都要自己实现

### 方案 P2 — `pi-ai` + `pi-agent-core`（通用 agent loop，推荐核心）

```
pi-ai (provider)  +  pi-agent-core (agent loop + 状态 + 工具调用 + 事件)
```
- `pi-agent-core` 是 **General-purpose** agent（非 coding），提供 agent loop、tool calling、消息状态、附件、事件
- **优点**：复用成熟的 agent loop（思考→工具→结果→继续）、状态管理、transport 抽象，不带入 coding 工具/session 假设
- **缺点**：session 持久化/compaction 等需自接或不用

### 方案 P3 — `pi-coding-agent` SDK 完整 harness（最全）

```
createAgentSession({ noTools: "all", customTools: [...RAG工具...], resourceLoader, sessionManager: inMemory })
```
- 用 `createAgentSession()` 拿到完整 `AgentSession`：含 compaction / retry / 事件流 / session 分支树 / settings
- **剥皮**：`noTools: "all"` 关掉 coding 工具，`tools: [...]` + `customTools` 只挂自己的 RAG 工具，`systemPromptOverride` 覆盖系统提示，`SessionManager.inMemory()` 避免落盘
- **优点**：最省事，白送一整套生产级 agent 基建（自动重试、上下文压缩、事件订阅）
- **缺点**：引入 coding-agent 假设（默认 cwd、AGENTS.md 发现、jsonl session 格式）；需用 `DefaultResourceLoader` 的 override 钩子"关闭"这些行为；包体更大

### 三方案对比

| 维度 | P1 (pi-ai + 自建) | P2 (pi-ai + pi-agent-core) ★ | P3 (pi-coding-agent SDK) |
|------|------|------|------|
| 依赖体积 | 最小 | 小 | 较大（含 coding 工具/TUI 资产） |
| agent loop | 自写 | ✅ 内置（通用） | ✅ 内置（完整） |
| 工具系统 | 自写 | ✅ `defineTool` | ✅ `defineTool` + 工厂 |
| 事件流 | 自写 | ⚠️ 需对接 | ✅ 完整（message/tool/turn/agent 事件） |
| compaction/retry | 自写 | ❌ | ✅ 内置 |
| session 持久化/分支 | 自写 | ❌ | ✅ jsonl 树（可 inMemory 关闭） |
| coding 假设 | 无 | 无 | 有（需 override 剥离） |
| 适合场景 | 极简单 RAG | **本项目主选** | 想要全套基建、不在意 coding 框架 |

**建议**：核心选 **P2**。需要完整 session/compaction/重试基建时升 **P3**（比如 Research 多轮研究要 checkpoint 恢复时）。

## 四、crystalith 各 feature 的 agent 重构思路

crystalith 现用 pydantic-graph 的「显式状态机图」与 pi 的「agent loop + tool calling」是两种范式。迁移时把图的每个节点变成 **agent 工具**，让 agent loop 驱动：

### 1. QA 基础问答（`features/qa/`）— 最契合
```
pi agent + retrieval 工具（搜 sqlite-vec → 返回带引用的 chunks）
```
用户提问 → agent 自主决定调 `retrieve_sources(query)` 工具 → 拿到带 chunk_id 的上下文 → 生成带引用标记的回答。**完美替代 pydantic-ai Agent + 手动 RAG 拼接。**

### 2. Outputs 结构化生成（`shared/agents/output_graph.py`，832 行图）
当前线性图 `ResolveContext → GenerateOutput → MapCitations → Postprocess → Persist`，可重构为：
- **方案 a**（保流水线语义）：保留为普通 async 函数链，不进 agent loop（生成流水线本就不是对话）
- **方案 b**（agent 化）：agent + `generate_structured(schema)` 工具 + `map_citations` 工具。每种 output 类型（FAQ/BRIEFING/...）注册成一个 schema 工具

> 建议：**MVP 用方案 a**（流水线直接复用逻辑），后续探索方案 b。

### 3. Citations 引用溯源（`features/citations/`）
做成工具的返回结构：`retrieve_sources` 工具返回 `{ chunk_id, text, source_id, page }[]`，前端据此渲染高亮 + 跳转。后端 `citations/context` 端点保留为普通查询。

### 4. Research agentic 研究（`features/research/graph.py`，13 端点 + 图，**若保留**）
这是 pi agent loop 的**最佳应用场景**：
- 工具：`web_search(query)` + `analyze(results)` + `synthesize`
- pi 的多轮 agent loop + session 分支树天然支持「搜索→分析→综合→用户审批→继续」
- **比手写 pydantic-graph 省一大半代码**，且 P3 方案的 session checkpoint 能支持中断恢复

### 5. Studio/Slides（`features/studio/`，流式生成）
pi 的 `message_update.text_delta` 事件流直接对接前端的流式幻灯片生成，替代当前的 SSE 端点。

## 五、pi vs Vercel AI SDK 对比（更新 [03](./03-ai-ecosystem-mapping.md)）

| 维度 | Vercel AI SDK | pi-agent-core / SDK |
|------|---------------|---------------------|
| 定位 | LLM 调用库（stream/generate） | **完整 agent runtime** |
| agent loop | ❌ 需自建（或用 experimental） | ✅ 内置成熟 |
| tool calling | ✅ `tool()` | ✅ `defineTool()` |
| 结构化输出 | ✅ `generateObject(schema)` | ⚠️ 经 tool + 约束（或结合 AI SDK） |
| session/compaction/retry | ❌ 全自建 | ✅ SDK 内置 |
| provider 覆盖 | 广（`@ai-sdk/*`） | 更广（30+，含 OAuth 订阅） |
| Bun 兼容 | ✅ | ✅✅ **自身即 Bun-built** |
| coding 假设 | 无 | P1/P2 无，P3 有（可剥离） |
| license | Apache-2.0 | **需确认**（npm 公开，见风险） |

**修订建议**：
- **agent loop 层**：优先 **pi-agent-core (P2)**，它比 AI SDK 多了完整 runtime，且与 Bun 目标天然契合；想轻量/只要结构化输出时退 AI SDK。
- **provider 层**：优先 **pi-ai**（覆盖广 + OAuth + 密钥管理完善）。
- 两者**不冲突**：可 pi-ai 做 provider + AI SDK 做 generateObject 做结构化，agent loop 用 pi-agent-core。

## 六、收益与风险

### 收益（强）
1. **直接复用生产级 agent runtime**：省去自写 agent loop / compaction / retry / 事件流 / tool 调度（合计潜在省 1500-3000 行等价 TS）。
2. **provider 抽象一步到位**：30+ provider + OAuth 订阅登录（ChatGPT Plus / Claude Pro / Copilot），crystalith 用户白嫖。
3. **Bun runtime 零摩擦**：pi 自己就是 bun build --compile 的产物，依赖链（undici/jiti/typebox）全部 Bun 验证过。
4. **tool 系统天然契合 RAG**：retrieval/citation 做成工具，agent 自主决定何时检索，比固定流水线更智能。
5. **同语言/同生态**：前后端 + agent runtime 全 TS，无跨语言边界。

### 风险（需应对）
1. **license 与版本耦合** — pi 是 `@earendil-works` 私有 scope 持续高频迭代（0.79.x），需确认 license 兼容（crystalith 是 Apache-2.0）和升级节奏。应对：锁定版本 + 关注 CHANGELOG。
2. **P3 方案的 coding 假设** — 若用 `pi-coding-agent` SDK，默认 cwd/AGENTS.md/jsonl session 需 override 剥离。应对：优先 P2 规避。
3. **结构化输出** — pi 的强项是 tool-driven agent，不如 AI SDK 的 `generateObject(schema)` 直接。应对：结构化场景混用 AI SDK（pi-ai 做 provider + AI SDK 做 generateObject）。
4. **session 格式绑定** — 若依赖 pi session 持久化，数据是 pi 的 jsonl 格式。应对：用 `SessionManager.inMemory()` + 自己的 Drizzle 持久化，pi 只负责 runtime。
5. **生成流水线范式差** — pydantic-graph 的线性流水线（Output 图）硬塞进 agent loop 反而绕。应对：流水线保留为普通代码，只把对话/研究类做成 agent（见第四节）。

## 七、建议落地

1. **provider 层**：用 `pi-ai`（替代 `shared/ai/`），Ollama/OpenAI 走 `models.json`，砍掉所有端点探测。
2. **agent 层**：核心用 `pi-agent-core` (P2) 跑 QA/对话；Research 若保留升 P3 用其 session checkpoint。
3. **生成流水线**（Output 图）：保留为普通 async 代码 + AI SDK `generateObject` 做结构化输出，不进 agent loop。
4. **工具化**：把 retrieval / citation / web_search 实现为 `defineTool`，挂给 agent。
5. **P0 spike 增项**：在原 PDF/向量/agent spike 基础上，加一个「pi-agent-core 跑通 crystalith QA 闭环」的验证（应该很快，因为 pi 本身 Bun-built）。

## 相关文档
- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — AI 生态对照总表（本文是其 pi 专题补充）
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈（pi 与之天然契合）
- [04-feature-trimming.md](./04-feature-trimming.md) — 功能裁剪（决定哪些 feature agent 化）
