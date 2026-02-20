## Context

outputs 当前依赖模型一次性生成满足 schema 的结构化内容；失败则使用 fallback。即使生成成功，也可能出现：

- 结构“形式正确但不可用”：空列表、字段缺失、重复严重、超长文本导致 UI 体验差。
- citations 异常：越界/重复/非整数，映射后引用混乱或为空。

现有机制：

- `MapCitations` 会把 `citations: list[int]` 映射为完整 citation 对象数组。
- `_ensure_minimum_content` 对部分 output_type 做了最小兜底，但覆盖面有限。

## Goals / Non-Goals

**Goals:**
- 在持久化前引入确定性的 postprocessing，使输出满足最低渲染契约（可用、可导出）。
- 按 output_type 提供可维护的后处理规则（去重、裁剪、排序、字段补全、citations 清洗）。
- 在 `preference=quality` 时允许受控的修复（repair pass）作为可选增强；speed 路径保持确定性与低成本。

**Non-Goals:**
- 不追求“语义完美”的自动修复（避免引入不可控的二次生成成本）。
- 不改变前端插件渲染逻辑（后处理以提升输入数据质量为主）。

## Decisions

### 1) 在 OutputGraph 中增加 PostprocessOutput 步骤

在 `GenerateOutput` 与 `MapCitations` 之间新增节点（或等价函数步骤）：

- 输入：`output_type`, `content (dict)`, `prompt`, `preference`, `resolved_chunk_ids`, `citations (pre-map)`
- 输出：清洗后的 `content` + 可选 `_warnings`

将“内容整形”与“引用映射”解耦：

- 先清洗 citations 索引（确保 list[int] 合法且在范围内/可接受）
- 再由 `MapCitations` 做映射

### 2) 规则组织：按 output_type 分派

新增模块（示例）：`backend/py/src/crystalith/shared/agents/output_postprocess.py`

每个 output_type 规则包含：

- `normalize(content) -> content`
- `warnings: list[str]`
- 可选 `quality_repair_needed(content) -> bool`

### 3) Repair pass（可选）

仅在以下条件触发：

- `preference == "quality"`
- 输出可解析但违反渲染契约（例如空列表/缺字段/明显不匹配）
- 且一次 repair 预算可控（最多 1 次）

repair prompt 目标：把“现有输出”修复为符合 schema/契约的结构（不做大幅改写）。

### 4) 元信息输出（兼容性新增）

允许在 content 中附加：

- `_warnings: string[]`（可选）
- `_postprocessed: true`（可选）

前端可忽略，或在 debug/质量提示 UI 中展示。

## Risks / Trade-offs

- [规则过严导致不必要改写] → 规则以“最低可用”为目标；尽量不改动语义，仅做去重/裁剪/补全。
- [repair 引入额外成本] → 仅 quality 路径、可控次数、并记录 observability 字段。
- [不同 output_type 维护成本] → 从最常见/最易坏的类型开始（QUIZ/TIMELINE/MINDMAP/FAQ），逐步扩展。

## Migration Plan

- 先实现确定性 postprocess，不启用 repair。
- 观察 fallback/渲染错误下降后，再评估是否开启 quality repair。

## Open Questions

- warnings 是否需要同时写入 Output DB 的单独字段（便于查询）还是仅在 content 内保存？
- slides markdown 是否也要复用同一后处理框架，还是单独处理（frontmatter/语法检查）？
