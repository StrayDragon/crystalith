# Embedding 模型接入指引

> 行为合约见 `llmanspec/specs/embedding-runtime`（r474–r479）。声明块 schema SSOT 在
> `packages/shared/src/schemas/model.ts`（`ModelEmbeddingCapabilitySchema`）；前缀模板与
> 维度断言在 `apps/server/src/rag/embedding-engine.ts`；vec 表维度守卫在
> `apps/server/src/db/vectors.ts`。配置入口为 `config/app.yaml` 的 `models.available`。

## 能力声明（`embedding:` 块）

`models.available` 里 `roles` 含 `embed` 的条目可以（按需）携带一个 `embedding:` 块，
声明该模型的嵌入能力。字段：

| 字段           | 必填（块内） | 含义                                                                       |
| -------------- | ------------ | -------------------------------------------------------------------------- |
| `dims`         | 是           | 嵌入维度（正整数）。建 vec 表、引擎维度断言、不匹配守卫都以此为准          |
| `mrlDims`      | 否           | MRL 可选维度列表。**目前仅声明与透出，截断行为未启用**（后续 change c133） |
| `modalities`   | 否           | 支持的输入模态，缺省 `['text']`                                            |
| `textOnlyLoad` | 否           | 是否仅接受文本输入加载                                                     |
| `prefixPreset` | 否           | 任务前缀内置预设名（见下节）。未声明 = 零前缀                              |

示例（照 `config/app.yaml` 现有条目）：

```yaml
- id: 'text-embedding-3-small'
  provider: 'openai'
  model: 'text-embedding-3-small'
  roles: [embed]
  embedding:
    dims: 1536

- id: 'gateway-embedding'
  provider: 'openai-compatible' # 本地网关（OMLX、llama.cpp --embeddings 等）
  model: "{{ env.CL_EMBEDDING_MODEL | default('bge-m3-mlx-8bit') }}"
  roles: [embed]
  embedding:
    dims: 1024
```

- 声明会原样透出到 `GET /v2/models` 的 ModelInfo（additive 字段）。
- 非法值在配置加载时直接拒绝：`dims` 非正整数、`prefixPreset` 未知名都过不了校验
  （合法预设名见 `packages/shared/src/schemas/model.ts` 的 `EMBEDDING_PREFIX_PRESET_NAMES`）。
- **不声明整个块** = 行为与现状完全一致：零前缀，建表维度回退默认 1024
  （`apps/server/src/db/vectors.ts` 的 `DEFAULT_EMBEDDING_DIM`，对应 bge-m3）。

## 任务前缀（prefixPreset）

EmbeddingGemma 家族的模型卡要求为 query / document 两种输入分别拼接任务前缀，
不拼不会报错，但检索质量会**静默下降**。为此 Crystalith 内置了预设模板集
（SSOT 在 `apps/server/src/rag/embedding-engine.ts` 的 `PREFIX_PRESETS`），模型条目
只填预设名，不开放自由模板串。

目前唯一预设 `embeddinggemma2`，模板原文：

| 角色     | 模板                                                  | 触发侧                                                                  |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| query    | `task: search result \| query: {原文}`                | 检索查询（embed-strategy 检索、research 工具注入）                      |
| document | `title: {title} \| text: {原文}`（title 缺省 `none`） | 文档索引（indexSource、sessions convert、re-embed；title 取来源文件名） |

何时声明：

- **该声明**：模型卡明确要求任务前缀的模型（EmbeddingGemma 2 等）——条目写
  `embedding: { dims: …, prefixPreset: embeddinggemma2 }`。
- **不该声明**：bge-m3、Qwen3-Embedding、OpenAI `text-embedding-*` 等无前缀要求的
  模型。未声明 = 输入原样送 provider，零前缀。

## 网关接入矩阵

Crystalith 只消费 OpenAI-compatible 的 `POST /v1/embeddings`；前缀由 Crystalith 侧
拼好后再送出，**网关拿到的是最终文本，对前缀无感知**。四种常见形态：

| 网关      | 形态                                       | 接入要点                                                                                                                                     |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| OMLX      | macOS（Apple Silicon）MLX server           | 本仓默认网关形态（`app.yaml` 里 `embed_gateway` anchor 指向 `http://127.0.0.1:50256/v1`）；bf16 加载友好                                     |
| Ollama    | 跨平台，自带 OpenAI 兼容层                 | baseUrl 指向 `http://127.0.0.1:11434/v1`；`model` 填 Ollama 模型名                                                                           |
| llama.cpp | `llama-server --embeddings -m <gguf>`      | OpenAI 兼容端点同进程暴露；GGUF 变体选择注意下节精度要求                                                                                     |
| TEI       | Hugging Face text-embeddings-inference     | 自带 `/v1/embeddings` OpenAI 兼容路由；服务端部署（GPU/CPU）                                                                                 |
| maas-eg2  | 自托管 EmbeddingGemma 2 服务（本项目实测） | 默认条目 `embeddinggemma2-gateway` 走专用 anchor（`CL_EMBEDDING2_API_BASE`，缺省 `http://tufa:50233/v1`）；768 维恒归一、真实 tokenizer 计数 |

provider 一律走 `openai-compatible`（本地网关）或 `openai`（云 API）， baseUrl/
apiKey 由 anchor + 环境变量驱动：`embed_gateway`（`CL_EMBEDDING_API_BASE`，
bge-m3 回退条目 `gateway-embedding`）与 `eg2_gateway`（`CL_EMBEDDING2_API_BASE`，
**默认条目 `embeddinggemma2-gateway`**，c131 T8 起生效）。

**EmbeddingGemma 2 特别注意**：多模态模型（2026-10 发布），第三方运行时
（Ollama / llama.cpp GGUF / TEI / MLX）支持尚在跟进，接入前**先实测**；一代
embeddinggemma（300M 纯文本版）已有 Ollama / GGUF 支持。**本仓默认条目已实测**
（2026-10-13，maas-embeddinggemma2 @ tufa:50233）：`ai@7.0.138` 零适配、768 维恒归一、
前缀模板与服务端 `:SearchQuery`/`:Document` 后缀逐位一致（cos≥0.999999）。
排错提示：AI SDK 的 `APICallError.message` 只有 "Bad Request"，详情看
`error.responseBody`；服务端单飞锁串行处理，客户端并发只会在服务端排队。

历史注记（2026-10-13，已修复）：maas 服务长跑进程曾出现 ROCm fp32+sdpa 注意力
NaN → 向量全 NaN → starlette `allow_nan=False` 裸 500（个别中文序列触发）。服务端已
加 `_encode_finite()` 兜底（GPU 非有限值 → CPU 重算）与可读 500（含 trace_id）；本仓
`scripts/embedding-quality.ts` 的触发串已恢复自然措辞并作为回归样例保留。

实测命令（网关地址按实际替换）：

```bash
curl -s http://127.0.0.1:50256/v1/embeddings \
  -H 'content-type: application/json' \
  -d '{"model":"bge-m3-mlx-8bit","input":"维度自检"}' \
  | jq '.data[0].embedding | length'
# 输出应等于该条目 embedding.dims 的声明值
```

## 精度警告：EmbeddingGemma 2 必须 bf16 / fp32

EmbeddingGemma 2 **必须以 bfloat16 或 float32 运行**；float16 会产生 NaN 向量或
静默质量劣化（模型卡原文语义）——后者服务不报错、只是检索分数整体变差，最难排查。

网关侧配置时注意：

- MLX（OMLX 等）默认 bf16 加载，与要求契合；
- llama.cpp 选 GGUF 权重变体时避开 float16（F16）版本；
- 若检索分数在换模型后异常低或出现 NaN，第一件事查网关的加载精度。

## 本机路径

- **Mac（Apple Silicon）**：首选 MLX 系（OMLX / mlx-lm server），bf16 加载，
  统一内存跑嵌入模型性价比高。
- **高内存 Linux**：本机 Vulkan / ROCm 后端可跑 llama.cpp（`--embeddings`）或
  Ollama。

两者对 Crystalith 都是同一种接入：OpenAI-compatible `/v1/embeddings` + 网关地址。
前缀拼接在 Crystalith 侧完成，网关不需要任何配合。

```bash
# .env（或 shell 导出）
CL_EMBEDDING_MODEL=bge-m3-mlx-8bit              # 网关上的模型名
CL_EMBEDDING_API_BASE=http://127.0.0.1:50256/v1 # 网关地址
CL_EMBEDDING_API_KEY=sk-local                   # 本地网关可随意填
CL_DEFAULT_EMBEDDING_MODEL=gateway-embedding    # 指向 app.yaml 条目 id
```

## 维度不匹配的处理

政策：**切模型 = 重建索引**。不同模型的向量空间互不可比，不做跨模型迁移。

现象（守卫代码：`apps/server/src/db/vectors.ts`）：

- **boot 警告**：启动日志出现
  `[db] vec_chunks 维度不匹配：现表 N 维 / 配置声明 M 维；…`（含两值，不阻断启动）。
- **检索/写入报错**：语义检索与向量写入返回 HTTP 409，错误码
  `EMBEDDING_DIM_MISMATCH`，文案含两值并指向重建入口。
- **keyword / BM25 检索不受影响**（不碰向量）；聊天、Studio、Deep Research 等
  其余功能照常可用。
- 另一层保险：provider 实际返回维度 ≠ 条目声明 `dims` 时引擎直接报错
  （`embedding-engine.ts`）——网关侧换了模型但没改配置会立刻暴露，而不是静默写脏向量。

处理步骤（c131 起**优先用一键重建**：来源面板工具栏的重建按钮，或
`POST /v2/notebooks/:nid/search-index/rebuild`；维度不一致时自动升级为整库重建，
确认弹窗会明示。手动 DROP 仅作兜底）：

1. 改 `config/app.yaml`：新模型条目如实声明 `embedding.dims`（需要前缀的模型同时
   声明 `prefixPreset`），`models.defaults.embedding` 指向它。
2. 停掉 server，清掉旧向量索引——vec0 虚拟表整表删除（chunks 正文行保留，只丢
   向量）：

   ```bash
   sqlite3 data/crystalith.db 'DROP TABLE vec_chunks;'
   # DB 路径默认 <storage.data_root>/crystalith.db，CL_DB_PATH 可覆盖
   ```

   （兜底路径；正常情况直接用重建按钮/端点，无需手动 DROP。）

3. 重启 server：`initVecChunks`（`apps/server/src/db/index.ts`）按新声明维度重建空表。
4. 对受影响笔记本全量重嵌（sourceIds 取自 `GET /v2/notebooks/:nid/sources`）：

   ```bash
   curl -s -X POST http://127.0.0.1:8032/v2/notebooks/1/sources/batch/re-embed \
     -H 'content-type: application/json' \
     -d '{"sourceIds":[1,2,3]}'
   ```

   批量重嵌对每个来源**先清空旧向量再重建**
   （`apps/server/src/features/sources/batch.service.ts`），逐条返回结果；失败项
   `errorCode=EMBEDDING_FAILED`，可对失败来源重复调用。

注意：报错只拦「维度变了」的情况。**同维度换模型**（两个模型都是 1024 维）不会
触发任何报错，但新旧向量空间不可比、混用会静默劣化检索——同样按上面 2–4 步重建。

## 质量基线（c131 T7，2026-10-13 实测）

`scripts/embedding-quality.ts`（手动跑，不进 CI）对 tufa:50233 的结果：

- 前缀一致性：query cos=1.00000002 · document cos=0.99999996（门槛 ≥0.999999）。
- 自检索 top-1：中文 0.887 · 中英混合 0.770 · 代码 0.867（三语料全中）。
- 延迟：单条 p50 27ms · batch×32 均值 95ms（约 338 条/s）。

重建期间的降级行为：QA 对话/单源问答返回提示文案（`noEvidenceReason` /
`degraded` = `index_rebuilding`）；outputs 与 studio 生成返回 409
`INDEX_REBUILDING`；research 检索工具返回空结果。
