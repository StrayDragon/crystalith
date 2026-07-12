---
depends_on: []
batch: all
---

# c53-fix-v2-sources-citations-contract — Sources qa-to-source 多轮 + tag per-item + CSV 转义 + citations 路径 + connector config 校验

## Why

2026-07-12 第四轮深度复核发现 sources 与 citations 域存在 **6 个 P1**（c30/c33/c39/c44 sources 端点齐全、G3 竞态真修了、G14 connectors 实为完整移植；但多处契约细节偏离 v1，部分是 c44 明确 deferral）。

### Sources 域

**P1-1 — qa-to-source 只接受单轮**

- v1 (`api_qa.py:186-209,204-209`): 接受 `messages: list[QAMessage]` 多轮历史，格式化完整 transcript。
- v2 (`source-extras.router.ts:228-231`): 只接受单轮 `{question, answer}`。多轮 QA 历史无法转换。c44 tasks 明确 deferral。

**P1-2 — tag 绑定响应缺 per-item 诊断**

- v1 (`api_tags.py:142-185,180-184`): 返回 `results: list[SourceBatchItemResult]`（per-item `{source_id, ok, message, error_code}`），缺失 source 报 `SOURCE_NOT_FOUND`。
- v2 (`router.ts:461,488,447`): 只返回 `{applied, skipped}` 计数；缺失 source 静默 `continue`。消费方拿不到 per-item 诊断。

**P1-3 — CSV parser 不转义 pipe/换行**

- v1 (`csv.py:61-67`): 转义 `|`→`\|`、换行、截断用 `…` 省略号。
- v2 (`parsers/csv.ts:64-67,70-76`): 不转义 pipe/换行，截断用 `...`（三个点）。含 `|` 或换行的单元格破坏 markdown table。

### Citations 域

**P1-4 — /context 路径偏离 v1 与 c26 承诺（BREAKING）**

- v1 (`api.py:13`): `prefix=/v1/notebooks/{notebook_id}/citations`，路径 `/v1/notebooks/:nid/citations/context`。
- c26 proposal.md:20 与 design.md:6 都承诺 `GET /v2/notebooks/:nid/citations/context`。
- v2 实现 (`router.ts:35,50`): 扁平 `/v2/citations/context?notebook_id=`。违反承诺且与所有其他 v2 特性的层级路径不一致。

**P1-5 — /context 默认 before/after 为 2（v1 是 1）**

- v1 (`api.py:61-62`): `Query(1, ge=0, le=5)` → 默认 1 before + 1 after。
- v2 (`router.ts:89-90`): 默认 2 before + 2 after。客户端省略参数拿 2 倍窗口。

### Source-Connectors 域

**P1-6 — connector config 无 JSON-schema 校验**

- v1 (`api.py:77-98,199-200`): 用 jsonschema Draft7Validator 校验 connection_config；非法 → 400。
- v2 (`router.ts:232-241`): 原样存储无校验。畸形配置静默接受。

## What Changes

1. **qa-to-source 多轮**: 接受 `messages: list[QAMessage]`，格式化 transcript，对齐 v1。
2. **tag 绑定 per-item**: 返回 `results[]`（per-item `{source_id, ok, message, error_code}`），缺失 source 报 `SOURCE_NOT_FOUND`。
3. **CSV 转义**: 转义 `|`/换行，截断用 `…`，对齐 v1。
4. **citations /context 路径修正**: 改回 `/v2/notebooks/:nid/citations/context`（**BREAKING**: 路径层级修正）。
5. **citations 默认 before/after=1**: 对齐 v1。
6. **connector config 校验**: 用 JSON-schema（Draft7 或 Zod 等价）校验，非法 → 400。

## Capabilities

- `source-ingestion-summary-and-conversion`（spec delta: qa-to-source 多轮 + tag per-item + CSV 转义）
- `evidence-review-workflow`（spec delta: citations 路径 + 默认值 + connector config 校验）

## Impact

- **qa-to-source 完整**: 多轮历史可转换。
- **tag 绑定可诊断**: 消费方拿到 per-item 成功/失败。
- **CSV table 不破坏**: 含特殊字符的单元格正确转义。
- **citations 路径对齐**: 符合 v1 与 c26 承诺（BREAKING 修正，需前端配合）。
- **connector 配置可信**: 非法配置被拒绝。
- **BREAKING**: citations /context 路径从扁平改回层级；前端需更新调用路径。
