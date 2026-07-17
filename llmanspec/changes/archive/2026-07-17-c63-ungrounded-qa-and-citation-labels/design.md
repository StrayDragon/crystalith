## Decision

将 QA 的 `source_ids` 空语义从「一律 no_sources」改为两分支：

1. **笔记本无来源** → 保持 `no_sources` 短路（不进 LLM）
2. **笔记本有来源但未勾选 / `source_ids` 空或缺失** → **ungrounded**：跳过向量检索，直接 LLM，`citations=[]`

非空 `source_ids` 仍限定检索子集。Chat UI 不再因未勾选禁用发送；Studio 等依赖来源入口继续 gating。引用 UI 同时展示唯一来源数与片段数。

## Alternatives considered

- **空 scope = 检索全库**：与勾选语义冲突，否决。
- **新增 `mode=ungrounded` 字段**：可更明确，但会扩大 API；沿用空 `source_ids` 更小改动。
- **仅改文案不改行为**：无法满足「未勾选可对话」。

## Implementation notes

- Server：`retrieveAndJudge` 在空 scope 时查 notebook 是否有 source；有则返回允许生成的空 citations 结果；handler 不注入 Source material（或注入空串）。
- Web：引用组件用 `Set(source_id)` 计来源数；按钮/弹层标题统一文案模板。
- 保持 `ensureInlineCitations` 在 `citations.length===0` 时不追加 `[1]`（已有行为）。
