## Why

个人 notebook 用久了，一个很常见的问题是：source 会不知不觉重复。原因很多：同一 URL 反复导入、connector sync_check 反复确认、PDF 改名后重新上传……检索时这些重复内容会把 context 挤爆，让 rerank 变得更随机，也让“我到底引用的是哪份”越来越难回答。

现在我们已经有去重相关的契约/流水线（例如 `c225`），但缺一个面向用户的“最后一公里”：把重复候选摆出来，让人能一眼看懂差异，并做出可逆的合并/忽略决定。

## What Changes

- 在 notebook 的 Sources 面板增加 `Possible duplicates` 入口，按“重复候选组”展示来源。
- 每个候选组展示“为什么像重复”：URL 规范化、标题/作者相似、chunk overlap、解析保真度相近等，并给出差异摘要（大小、更新时间、提取/解析 provenance）。
- 提供三类动作（都要可撤销）：
  - `Merge`：选择一个 canonical source，把其它 source 标记为 alias/redirect，并把引用/索引指向 canonical。v1 可以先做到“检索层合并”，不急着做物理删除。
  - `Keep separate`：明确告诉系统这组不该去重（写入 ignore rule），避免后续反复出现。
  - `Park`：先放一边，减少噪音（软隐藏，不影响数据完整性）。
- 合并动作的边界：
  - v1 不做“自动删除文件/远端数据”；只在 Crystalith 内部做引用与索引层面的收口。
  - 任何会改变可见结果的动作都要留 audit note（何时合并、合并理由、可回滚入口）。

## Capabilities

### New Capabilities

- `source-dedup-review-ui-and-merge-actions`: 去重候选组展示、可逆合并/忽略动作、以及合并后别名语义。

### Modified Capabilities

- `source-deduplication-and-canonicalization-pipeline`（`c225`）：需要输出“可解释的重复候选组”，而不只是内部判定。
- `workspace-ui-panels`：Sources 面板承载去重入口与差异摘要。
- `retrieval-and-cache`：检索与 context assembly 需要尊重 alias/redirect，避免重复 chunk 进入上下文。
- `quality-gates-for-generation`：可选，把“重复来源过多”作为提醒信号（不阻断）。

## Impact

- Frontend：新增一个去重 review 视图；Sources 列表支持 alias 标记与过滤。
- Backend：提供 duplicates candidates API、merge/ignore action API、以及 alias 在检索链路的落点。
- Dependencies：强依赖 `c225-source-deduplication-and-canonicalization-pipeline`；建议与 `c260-source-trust-signals-and-quality-hints` 共享“置信度/解释”组件。

```mermaid
flowchart TD
  A[Ingestion / Connector import] --> B[Canonicalization + Dedup signals]
  B --> C[Duplicate groups API]
  C --> UI[Possible duplicates UI]

  UI -->|Merge (reversible)| M[Alias/Redirect mapping]
  UI -->|Keep separate| I[Ignore rules]
  UI -->|Park| P[Soft hide list]

  M --> R[Retrieval + Context assembly]
  I --> B
  P --> R
```
