## Why

结构化输出的“可用性底线”目前依赖模型一次性生成正确结构：一旦字段缺失、列表为空、重复严重或 citations 异常，前端渲染会降级为错误提示/原始 JSON，用户体验与导出质量都会受影响。与此同时，单纯增加重试并不能保证语义质量，且会增加延迟与成本。

因此需要一个确定性的后处理层：在不引入额外模型调用（或仅在质量优先时受控引入）的前提下，提高输出一致性、可渲染性与引用可靠性，让“质量”不仅依赖模型能力，也依赖系统工程保障。

## What Changes

- 在 outputs（以及适用的 slides 内容）生成后、持久化前增加 Postprocessing：
  - 结构修复：空列表/缺失字段补全、类型纠正、去除无意义空白
  - 质量整形：去重、裁剪过长项、按“数量”偏好控制条目数量上限
  - 类型特化：timeline 事件排序；mindmap 深度/分支限制；quiz 题型与选项一致性等
- 强化 citations 处理：
  - citations index 合法性校验与裁剪（越界/重复/非整数）
  - 关键字段 citations 兜底策略（在 evidence 充分时避免空引用）
-（受控）Repair pass：
  - 当模型输出“可解析但不满足渲染契约”时，在 `preference=quality` 下允许一次轻量修复提示（否则直接 deterministic 修复/回退）。
- 兼容性：后处理新增的 `_warnings`/`_quality` 等元信息应为可选字段，不破坏现有前端渲染（前端可选择性展示）。

## Capabilities

### New Capabilities
- `output-postprocessing`: 定义各 output_type 的后处理规则、修复策略、warnings 约定、以及在 speed/quality 倾向下的差异化行为。

### Modified Capabilities
- `agent-architecture`: OutputGraph 在 MapCitations 后需要保证内容满足最低渲染契约（可引入显式 PostprocessOutput 节点或等效步骤），并在持久化前落地后处理结果与 warnings。

## Impact

- Backend
  - outputs：后处理模块化（按 output_type 分派），减少前端“无效数据”渲染错误
  -（可选）slides：对 markdown/frontmatter 的规范化与安全检查
- Frontend
  - 默认无需改动；可选增强：展示 `_warnings` 以提示“证据不足/上下文被截断/已自动修复”
- 测试/验收
  - 为每个 output_type 增加后处理的 golden cases（输入→输出稳定、可渲染）
