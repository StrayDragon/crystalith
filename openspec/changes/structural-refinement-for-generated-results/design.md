## 背景

很多时候用户并不想整篇重来，而是想“把这段展开一点”“把这个结论改得更严谨”“把这里重写成更适合汇报的结构”。这要求系统把结果看成可被继续改良的结构对象，而不是一次性整块文本。

## 已确定决策

### D1：refinement 围绕结构单元展开
- 结果必须被识别为可操作的结构单元。
- refinement 不是无边界地对整块结果做再次生成。

### D2：局部改写与整篇重生成必须分开
- 并不是所有改良都适合局部完成。
- 系统需要明确哪些动作属于局部 refinement，哪些应回到重新生成。

### D3：refinement 必须建立在已有结果上下文上
- refinement 需要消费当前结果、上下文和目标差异。
- 它不重新发明一套新的结果类型模型。

### D4：不允许为了 refinement 反向重写公共框架
- 结果结构和 refinement 动作都应消费上游稳定语义。
- 不为了支持局部操作而改写生成类型框架。

## 已确定的具体定义

### 结构单元

- `section`（章节/段落）
- `evidence_block`（引用/证据块）
- `conclusion`（结论/摘要）
- `list_item`（列表项）

### Refinement 动作集合

| 动作 | 作用范围 | 描述 |
|------|---------|------|
| `expand` | section / evidence_block | 展开一个结构单元，增加深度 |
| `compress` | section | 压缩，保留核心观点 |
| `rewrite` | section / conclusion | 重写以改变风格/严谨度 |
| `reorder` | 同级 sections | 调整章节顺序 |
| `regenerate_local` | 任意单元 | 保留上下文，仅重新生成该单元 |

### 局部 refinement vs 整篇重生成判定规则

- 如果操作影响 **1-2 个相邻结构单元** → 局部 refinement
- 如果操作影响 **>50% 的结构单元** 或 **改变核心论点** → 建议整篇重生成
- 如果局部 refinement 后 **引用链断裂** → 提示用户选择：修复引用 or 整篇重生成

## refinement 如何消费已有结果上下文

refinement 的输入不应只是一段原文 + 一句指令，而需要稳定地携带“局部上下文”以避免改良把结果改坏或改断（尤其是 evidence/citation）。

### 结构单元标识（UnitId）

- 每个可操作结构单元必须有稳定 `unit_id`（例如由结构解析生成，或来自 `typed-generation-framework` 的 `structured_schema`）。
- `unit_id` 只用于定位与变更范围表达，不引入新的“结果类型模型”。

### 局部上下文（LocalContext）最小集合

对一次局部改良，系统至少提供以下上下文给 refinement 执行器（或 LLM）：

- 目标单元当前内容（target content）
- 目标单元的“父级/标题路径”（帮助保持结构一致）
- 相邻单元的标题/摘要（帮助保持衔接）
- 与该单元相关的 evidence/citation 摘要（若存在）
- 结果级元数据：`generation_type_id` / `output_type_id`、是否允许 refinement（消费上游公共词汇）

## 接口与更新语义（最小可实现草案）

### 局部改良请求：作用范围 + 动作 + 指令

```json
{
  "result_id": "res_...",
  "operation_kind": "local_refinement",
  "generation_type_id": "research",
  "output_type_id": "briefing",
  "scope": {
    "unit_ids": ["u_12"],
    "action": "rewrite"
  },
  "instruction": "把这段改得更严谨，并补上必要的证据。",
  "local_context": {
    "target_unit": { "unit_id": "u_12", "content": "..." },
    "path": ["结论", "局限性"],
    "neighbors": [{ "unit_id": "u_11", "summary": "..." }],
    "evidence": [{ "source_id": "...", "quote": "...", "loc": "..." }]
  }
}
```

- `operation_kind` 必须显式标识这是“局部改良”还是“整篇重生成”，避免 API/UI 混淆。
- `scope.unit_ids` 默认为 1 个；`reorder` 等动作允许多个同级 unit_id。

### 结果回写：保留未改动部分 + 记录变更范围

局部改良写回必须满足：

- 未被 scope 覆盖的结构单元保持内容不变（除非用户选择升级为整篇重生成）。
- 系统记录本次变更范围与动作，形成可追溯的改良记录。

```yaml
RefinementRecord:
  id: string
  ts: time
  operation_kind: enum           # local_refinement | full_regeneration
  action: string
  scope_unit_ids: list[string]
  summary: string | null         # 给 UI 的一句话摘要
```

### 变更记录与版本关系（v1）

- v1 不要求实现复杂分支版本树，但必须能在结果对象上查询到 refinement 历史（至少包含 `RefinementRecord` 列表）。
- 需要“撤销/对比”的场景可后置；本 change 先固定变更范围与记录语义。

### API 与 UI 如何标识局部改良 vs 整篇重生成

- API 通过 `operation_kind` 显式标识。
- UI 在结果页展示清晰 badge：
  - “局部改良：rewrite（u_12）”
  - “整篇重生成：根据新约束重新生成”
- 当系统判定超出局部边界时，必须把操作升级为整篇重生成（并在 UI 明确告知），不得把大改伪装为局部成功。

## 产品体验：如何发起与共存

### 从结果中选择结构单元发起改良

- 结果渲染时，为每个结构单元提供可交互区域（hover 高亮/右键菜单/更多按钮）。
- 支持“选择一个单元 → 选择动作 → 输入指令 → 预览/应用”。
- 对 evidence_block，优先提供“补证据/替换证据/解释证据”的动作入口（动作集合仍受本 change 限定）。

### 结果级改良与局部级改良如何共存

- **局部级改良**：面向 1-2 个结构单元的精修（本 change 的重点）。
- **结果级改良**：面向全局目标（例如“改成面向初学者的版本”），应走整篇重生成或更高层工作流。
- UI 同时提供两类入口，但必须明确区分操作种类与影响范围，避免用户误解。

### 明确边界：不重定义生成类型或输出类型模型

- 本 change 不新增/重写 `GenerationType` 或 `OutputType` 的定义，只消费其 `generation_type_id` / `output_type_id` 与“是否允许 refinement”等公共语义。
- 结构单元的 `unit_id` 是“定位与范围表达”的技术标识，不构成新的结果类型体系。

### 后置项说明

- D4 中的"反向重写公共框架"后置条件：**本 change 永远不允许反向修改上游框架**

## 非目标

- 不把所有修改需求都写成局部 refinement。
- 不重新发明一套结果类型体系。
- 不让 refinement 反向定义公共类型术语。
