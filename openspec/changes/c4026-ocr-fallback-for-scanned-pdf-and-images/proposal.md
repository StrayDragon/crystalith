## Why

PDF 并不总是“有文字的 PDF”。有一大类资料是扫描件或图片拼出来的：看起来内容很全，但解析出来却是一片空白，或者只剩零碎的页眉页脚。对个人用户来说，这种体验很伤：你明明导进来了，却怎么也搜不到、也问不出来。

我们已经在补齐提取回退链（`c2048`）和解析能力矩阵（`c2153`），下一步应该把 OCR 明确纳入“可解释的回退路径”，而不是靠运气。

但 OCR 不是银弹：识别错字、段落断裂、表格跑偏都很常见。如果系统只把 OCR 当成“成功/失败”的二元结果，用户很难判断该不该信、该不该引用，最后还是会回到“我不太敢用”的状态。OCR 的 provenance 与质量信号必须变成一等公民，能进入来源提示与检索权重，避免黑箱。

## What Changes

- 引入 OCR 作为一类 parser fallback：
  - 当 PDF/图片类来源的“文本覆盖率”低于阈值时，自动尝试 OCR。
  - 允许用户在来源详情里手动触发“运行 OCR”（避免误触导致资源浪费）。
- OCR 结果必须可解释：
  - 记录使用的 OCR 引擎/语言/页数范围/置信度与覆盖率，作为 provenance 写回来源。
  - 在来源详情显示“本来源使用了 OCR”的明显标记，并把“可能不准”的风险说清楚。
- OCR 质量信号要可被消费：
  - 低覆盖率/低置信度：来源详情展示 warning，并在检索层可选择下调权重或排除。
  - 高置信度：正常参与检索，但仍保留“来自 OCR”的标记（便于核证）。
- 提供可控的“重跑 OCR”入口（不强求一次成功）：
  - 切换语言、调整质量档位、限定页数范围（v1 先做最常用的两个参数即可）。
- OCR 要进入既有的 ingestion 流水线：
  - OCR 输出文本参与 chunking/embedding/retrieval，但需要和原始解析结果保留可追溯关系（同一 source 下的多个 text_variant）。
- 约定降级边界：
  - v1 不追求完美版式还原（表格/多栏先不做强承诺），先把“能搜、能引用”做稳定。

## Capabilities

### New Capabilities

- `ocr-fallback-for-scanned-pdf-and-images`: OCR 触发条件、回退语义、以及 provenance/置信度的最小字段集。
- `ocr-provenance-and-quality-signals`: OCR provenance/quality 字段、阈值与 UI/检索消费规则。

### Modified Capabilities

- `extractor-fallback-chain-and-capture-provenance`（`c2048`）：提取 provenance 需要能表达“内容是图片型”的判断信号。
- `parser-capability-matrix-and-format-fallbacks`（`c2153`）：把 OCR 作为明确的 format fallback，并写清保真度边界。
- `source-ingestion-core`：把 OCR 变成 ingestion 的一条可诊断分支，而不是隐藏实现细节。
- `source-trust-signals-and-quality-hints`（`c1009`）：把 OCR 信号纳入来源信任提示。
- `source-readiness-and-freshness`（`c2001`）：来源 readiness 需要把“可用但需谨慎”表达出来。
- `retrieval-and-cache`：检索与 rerank 需要能尊重 OCR 质量信号（至少支持 downweight/exclude）。
- `official-plugins`：OCR 引擎建议以官方插件交付（core-only 不强拉重依赖）。

## Impact

- Backend：新增 OCR 回退步骤、provenance/quality 字段写回、以及 text_variant 的持久化约定；检索侧提供非常保守的 downweight/exclude 默认策略。
- Frontend：来源详情增加 OCR 状态/触发/重跑入口与 warning；导入后提示更准确（“解析为空 → 建议 OCR”）。
- Dependencies：建议接在 `c2048`、`c2153` 之后推进；并与 `c1009`/`c2001` 对齐提示语义；作为 `c2049`（官方插件）的一条落地验证路径。

```mermaid
flowchart TD
  IN[Source captured] --> P1[Primary parse]
  P1 --> COV{Text coverage ok?}
  COV -->|yes| OK[Chunk + embed]
  COV -->|no| OCR[OCR fallback parse]
  OCR --> OK

  P1 --> PROV[Capture/parse provenance]
  OCR --> PROV
  PROV --> UI[Source detail + hints]
```
