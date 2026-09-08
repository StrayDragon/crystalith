# Design — allow-low-similarity-qa

## D1 放行语义：无接地，而非「带低质上下文」

两个选项：

- A. 仍把低分片段喂给 LLM + 提示「来源相关性低」——模型可能对弱相关文本
  产生引用幻觉（citations=[] 与引用行为矛盾）
- B. 完全无接地（context=''、citations=[]）+ 提示「回答基于模型通用知识」

**选 B**：与 c60 ungrounded chat 既有路径完全同形（evidence=true、空
context），零新分支；且「低相似度」本就说明片段不可信，喂进去只会污染。
retrieved 的片段不丢弃也没关系——同问题换个问法或后续对话重新命中。

## D2 提示的投递（settleNotice）

`streamQaResponse` 新增可选 `settleNotice?: string`：

- 生成循环结束后、`done` 事件前，emit `chunk { text: settleNotice }`
- 并 append 进 `accumulated`，使 `onMessageSettled` 落库文本包含提示
  （流式与持久化两侧一致；不传该字段的行为完全不变）

提示文案（常量 `WEAK_GROUNDING_TIP`）：
「\n\n---\n*提示：未在勾选来源中找到与问题高度相关的内容，以上回答主要基于模型通用知识，未引用来源。*」

## D3 reason 不变量

`JudgeResult.reason` 收紧为「仅 `evidence: false` 时设置」。低相似度放行时
`reason` 为 undefined、`groundingNotice` 有值——`done.noEvidenceReason` 因此
为 undefined，前端不受影响（当前前端未消费该字段，已核实）。

## D4 阈值语义变化

`minScore`（默认 0.2 / `EVIDENCE_THRESHOLD_DEFAULT`）不再决定「能否回答」，
只决定「是否附弱接地提示」。阈值本身数值不变。
