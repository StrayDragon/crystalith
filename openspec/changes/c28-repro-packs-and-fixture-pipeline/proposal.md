## Why

“你这次生成错了”的反馈，如果没有可复现输入，最后往往只能靠运气：源文档变了、检索候选变了、模型 endpoint 变了、配置 overlay 变了。一次排障能拖很久，而且很难形成稳定的回归样本。

我们需要一个能随手打包、默认脱敏、可重复跑的 repro pack，把“现场”保存下来。

## What Changes

- 定义 `ReproPack` 作为可分享的最小复现包（默认脱敏）：
  - effective config 的摘要（敏感字段遮罩）
  - sources 清单 + 内容指纹（hash）+ 关键片段（可选）
  - retrieval_snapshot_id（来自 `c26`）
  - 模型选择与 endpoint candidates（记录最终命中的那个）
  - correlation_id + 最小诊断信息（引用 `c12`）
- 提供导出/导入与回放入口：
  - 导出：从一个 run/output 打包成 repro pack
  - 回放：在本地用相同输入跑一次，产出 diff（先对结构/引用，再对全文）
- 提供 fixture 管道：把 repro pack 中的敏感信息进一步最小化，形成可进仓库的回归样本（为 `c27` 的 dataset 捕获服务）。

## Capabilities

### New Capabilities

- `repro-packs-and-replay`: repro pack 的结构、脱敏规则、导入导出与回放语义。

### Modified Capabilities

- `quality-and-regression`: repro pack/fixtures 如何进入回归体系与 triage 流程。
- `data-and-storage`: repro pack 的存储位置、保留策略与体积护栏（关联 `c18`）。
- `delivery-and-deployment`: 回放命令的标准入口与 CI 运行策略（先本地，后 CI）。

## Impact

- Debug：排障从“复现不了”变成“拿包就能跑”；也更容易做“失败样本库”。
- Security：脱敏规则必须是硬约束，避免把 token、cookie、原文大段内容打包出去。
- Dependencies：建议先落地 `c12` 的诊断包概念与 `c26` 的 snapshot，再做 repro pack 的打包与回放。

## Dependency Sketch

```mermaid
flowchart LR
  RUN[Run/Output] --> SNAP[retrieval_snapshot_id]
  RUN --> CONF[Effective config (redacted)]
  RUN --> DIAG[correlation_id + diagnostics]
  SNAP --> PACK[ReproPack]
  CONF --> PACK
  DIAG --> PACK
  PACK --> REPLAY[Replay & Diff]
  PACK --> FIX[Sanitized fixture]
```
