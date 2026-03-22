## Why

OCR 能把“看起来有内容但解析为空”的资料救回来，但它也会带来新的坑：识别错字、段落断裂、表格跑偏……如果系统只把 OCR 当成“成功/失败”的二元结果，用户很难判断该不该信、该不该引用，最后还是会回到“我不太敢用”的状态。

这份提案把 OCR 的 provenance 和质量信号做成一等公民，让它能进入来源 readiness、检索权重与 UI 提示，减少黑箱。

## What Changes

- 定义 OCR provenance 的最小字段集（写回 source）：
  - `engine`、`language`、`pages_ocrd`、`text_coverage`、`confidence_summary`（例如均值/分位数）。
- 定义 OCR quality signals，并和来源信任提示打通：
  - 低覆盖率/低置信度：在来源详情展示 warning，并在检索层可选择下调权重或排除。
  - 高置信度：正常参与检索，但仍保留“来自 OCR”的标记（便于核证）。
- 提供可控的“重跑 OCR”入口（不强求一次成功）：
  - 切换语言、调整质量档位、限定页数范围（v1 先做最常用的两个参数即可）。
- 让质量信号可复用：
  - `c260` 的 trust hints、`c03` 的 freshness hub、以及后续的 quality gates 都能消费同一套字段。

## Capabilities

### New Capabilities

- `ocr-provenance-and-quality-signals`: OCR provenance/quality 字段、阈值与 UI/检索消费规则。

### Modified Capabilities

- `ocr-fallback-for-scanned-pdf-and-images`（`c246`）：OCR 回退落地后，需要把结果质量变成可见、可解释的信号。
- `source-trust-signals-and-quality-hints`（`c260`）：把 OCR 信号纳入来源信任提示。
- `source-readiness-and-freshness`（`c03`）：来源 readiness 可以把“可用但需谨慎”表达出来。
- `retrieval-and-cache`：检索与 rerank 需要能尊重 OCR 质量信号（至少支持 downweight/exclude）。

## Impact

- Backend：新增 provenance 持久化与检索侧权重策略（默认策略要非常保守，避免让质量信号变成隐形开关）。
- Frontend：来源详情增加 OCR 信息；检索/阅读 UI 可以更明确地提示“这段是 OCR 来的”。
- Dependencies：依赖 `c246`；也建议提前把 `c260` 的 trust hints 结构做成可扩展（别写死字段）。

```mermaid
flowchart TD
  OCR[OCR result] --> META[Provenance fields]
  META --> SRC[Source detail UI]
  META --> TRUST[Trust hints (c260)]
  META --> READY[Readiness/freshness (c03)]
  META --> RET[Retrieval weighting]

  RET --> OUT[Search + context]
  SRC --> ACT[Re-run OCR options]
```
