---
depends_on: []
skip_specs_landing: true
branch: sdd/allow-low-similarity-qa
base_sha: a415382c634b5ed38fe5140cf2529fab78d59076
checkpointed: true
checkpoint_sha: a415382c634b5ed38fe5140cf2529fab78d59076
---

# Proposal — allow-low-similarity-qa（低相似度放行 + 弱接地提示）

> 状态：Designed。QA 检索证据裁判的低相似度短路行为变更（实现层自 v1 移植后
> 无 spec 合约背书，本 change 同时是该行为的首次产品决策记录）。

## Why

现状：QA 检索到片段但平均相似度 < 0.2 时，`retrieveAndJudge` 直接短路返回
拒答文案（「检索到了片段，但与问题的相似度偏低…」），**不进入 LLM 生成**。
真实使用中这是常态路径——短问题 vs 长文档（如刚导入的 arXiv 全文）的
embedding 相似度天然偏低，正常对话被拦截，体验非常不友好。

产品决策（2026-09-08）：低相似度 = **弱接地**，不是「无可回答」。放行为
正常对话（LLM 生成），并在回答尾部附提示，告知用户本次回答基本未使用勾选
来源。

## What Changes

- `retrieveAndJudge`：`low_similarity` 分支不再短路，改为**无接地放行**——
  `evidence: true`、`citations: []`、`context: ''`（不喂低质片段，避免模型
  假装引用）、`confidence: 0`，新增 `groundingNotice`（本地化提示文案）
- `JudgeResult.reason` 语义收紧：仅在 `evidence: false` 时设置（不变量）
- `ai/stream.ts` 的 `StreamQaOptions` 增加可选 `settleNotice`：流尾补发一个
  chunk 并计入落库文本（向后兼容的可选字段）
- QA handler：`low_similarity` 放行后经由既有 ungrounded 路径生成；提示以
  settleNotice 追加在回答尾部（先答后提示）
- 其余短路理由保持不变：`no_sources` / `no_vector_hits` / `no_valid_chunks` /
  `embedding_empty` 仍是硬短路（无来源/索引/配置问题需要用户行动）
- wire 零改动：提示走既有 `chunk` 事件与消息文本；`done.noEvidenceReason`
  在放行路径为 undefined

## 非目标

- 不做 UI 独立的「弱接地」徽章/组件（提示先落在消息文本内，观察反馈）
- 不改其他短路理由的短路行为
- 不调阈值本身（0.2 维持；放行后阈值只影响是否附提示，不再影响能否回答）
