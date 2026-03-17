## Context

当前与生成相关的控制逻辑分散在多个层面：某些判断靠模型选择器，某些失败靠统一重跑，某些输出靠后处理兜底，某些结果甚至只能直接作废。这会导致两个问题：第一，用户很难理解为什么某次生成失败、为什么系统这次可以降级那次不能；第二，下游 output types 容易长出自己的私有预检、重试和修补逻辑，最终破坏 typed generation framework 的边界。

本合并变更把这些控制点都收敛到同一个 generation governance loop：compatibility preflight → generation attempt → retry/fallback decision → validation/repair → final result state。

## Goals / Non-Goals

**Goals:**

- 让 generation type 成为兼容性、降级和修补的唯一控制面根节点
- 定义模型能力画像与 output compatibility 的统一预检
- 定义稳定的 error taxonomy 与 retry buckets
- 定义可解释、可回退的 safe degradation 与 repair loop

**Non-Goals:**

- 不在本变更里定义所有 GenerationType/OutputType 的完整目录
- 不在本变更里展开具体 prompt 文本或模型供应商细节
- 不把 repair 变成偷偷改写核心事实内容的“自动润色器”

## Decisions

### 1. GenerationType 持有 recovery contract，OutputType 不再自带私有治理逻辑

- generation type 除了输入要求、输出 contract 和完成语义外，还要声明 compatibility needs、allowed fallback classes、repair policy
- output type 只描述承载和渲染边界，不负责私有 preflight / retry / repair 逻辑

### 2. 所有结构化生成都先做 compatibility preflight

- preflight 统一评估 model capability、schema complexity、context sufficiency、input minima 和 output contract
- 结果只能是 hard block、soft warning 或 fallback-eligible
- 预检既服务用户入口提示，也服务后端 recovery planner

### 3. 失败必须先进入稳定 error bucket，再决定 retry / fallback / repair

- 失败先按 schema、parse、model capability、context insufficiency、postprocess、unknown 等 bucket 分类
- retry 策略绑定 bucket，而不是统一“再试一次”
- fallback planner 只能消费标记为 fallback-eligible 的 bucket

### 4. Safe degradation 必须显式声明能力损失

- 降级不是简单换模型或换 schema，而是一个带说明的结果状态
- 系统必须标记丢失的能力（例如 citation strictness、structured schema fidelity、refinement availability）
- 用户未授权替代的核心能力不得被静默降级

### 5. Repair loop 只处理结构完整性问题，不改写核心事实语义

- repair 只针对字段缺失、结构不完整、局部 payload 非法等可验证问题
- auto-repair、confirm-before-repair、must-rerun 必须有清晰边界
- repair 前后要可比较、可回退，并保留原始失败上下文

## Risks / Trade-offs

- [控制面变重，导致简单生成路径也显得复杂] → 默认把低风险成功路径保持为直通，仅在预检失败或后验校验失败时暴露治理信息
- [fallback 与 repair 责任混淆] → fallback 只负责生成路径替代，repair 只负责结果结构修复，两者通过 bucket 分类衔接
- [过多 error bucket 导致维护困难] → v1 只保留少量高价值 bucket，未知错误先收敛到 conservative fallback/no-repair
- [不同 output types 想保留私有特例] → 统一要求 recovery hooks 通过 generation type 扩展位表达，不再允许分叉治理面

## Migration Plan

1. 先定义 generation type 的 compatibility / fallback / repair hooks
2. 引入 model capability profiles 和 preflight evaluator
3. 将现有失败路径接入稳定 error taxonomy 与 retry buckets
4. 在 post-generation validation 后接入 repair loop，并移除输出类型私有 recovery 分叉

回滚边界：若统一 governance loop 在实施阶段无法覆盖关键生成类型，可回滚整个 change，不保留输出类型私有 recovery 的长期兼容层。

## Open Questions

- v1 是否允许某些低价值 output type 只支持 fallback、不支持 repair
- bucket 分类是否需要区分 provider-level transient error 与 model semantic mismatch，还是先统一收在 model bucket
