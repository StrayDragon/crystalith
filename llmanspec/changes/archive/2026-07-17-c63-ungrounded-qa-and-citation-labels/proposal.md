---
depends_on: []
---

## Why

左侧「已选 N/M」是来源勾选范围，右侧「引用详情 (K 条)」是命中的 chunk 片段数；二者语义不同，当前文案易让用户误以为勾选被无视。

同时，未勾选来源时 QA 会走 `no_sources` 短路并拒绝进入 LLM，阻碍「普通闲聊 / 无 RAG」用法。需要把「笔记本无来源」与「用户主动不选来源」拆开。

## What Changes

- **QA `source_ids` 语义**：缺失或空数组且笔记本仍有来源时，MUST 跳过检索，直接无引用 LLM 生成（ungrounded）；仅当笔记本本身无任何来源时，才返回 `no_sources`。
- **勾选范围**：非空 `source_ids` 仍 MUST 将检索限定在勾选子集（现有行为保留）。
- **Chat UI gating**：Chat 发送 MUST NOT 仅因未勾选来源而禁用；依赖来源的 Studio/生成入口仍可 gating。
- **引用文案**：引用按钮/弹层 MUST 区分「来源数」与「片段数」（例如「来自 1 个来源 · 3 个片段」）。

## Capabilities

- `generation-core`
- `retrieval-and-cache`
- `workspace-ui-panels`

## Impact

- **BREAKING（行为）**：空/`source_ids` 省略不再恒等于 `no_sources` 短路；未勾选时会进入 LLM。
- 前端 Chat 发送路径与引用文案；服务端 `retrieveAndJudge` / QA handler。
- 不影响笔记本完全无来源时的 `no_sources` 合约。
