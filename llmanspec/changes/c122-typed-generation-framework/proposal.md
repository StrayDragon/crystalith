---
depends_on: []
---

# 落地 typed-generation-framework 层：生成类型一等公民 + presets 家族闭环

## Why

用户决策（2026-09-29）：**整层实现**（非退场）。生成类型合约层（typed-generation-framework + generation-presets-and-constraints 全部 bare 条款）当前零实现——`generationTypeId`/`defaultOutputType`/effective controls 全仓零命中。同时 presets 家族核查出**幻影覆盖**：r23/r25 的场景挂在被 SKIP 的 BDD qa 域上，QA 链路实际对未知预设静默回退 default（r23 违约）、对 `enabled=false` 无检查（r25 违约）、custom 预设 CRUD（c61）完全不被生成链路消费（r24 半实现）。本 change 按用户原则「spec 绑定对应验证后自动守护」把整层做实：**代码先行为 SSOT，specs 全部落成嵌套场景并绑定真实测试**。

## What Changes

- **shared SSOT**：新增 `generation-type.ts`（`GenerationTypeIdSchema = qa|output|slides` 词汇 + 类型合约/列表/回传 schema + qa 控制项 schema）；`QaNestedRequestSchema` 增必填 `generationTypeId` 与 `controls`；`QaAnswerSchema` 增 `generation` 回传；`OutputGenerateBodySchema` 增必填 `generationTypeId`、`type` 改可选（缺省取注册表默认 `PARAGRAPH`）；`OutputSchema` 增 `generationMeta`；`PromptPresetSchema` 族增 `generationTypeId`。
- **server 注册表 + 端点**：`features/generation-types/`（registry + `GET /v2/generation-types`，r466/r323）。
- **qa 装配链**：generationTypeId 缺失/未知/错配 → 400（r324）；custom 预设接入解析（trigger 命中 → systemPrompt 覆盖，r24）；未知预设 → 400 带内置+custom 全名单（r23 修复）；`enabled=false` → 确定性 400（r25 修复）；裸 `/prompt:<name>`（无 query）→ 400 带用法与名单（r422）；控制项（lengthHint/requireCitations）注入 prompt 并回传 effective controls（r186/r189）；响应回传 generation 元数据（r326）。
- **outputs 装配链**：generationTypeId 校验（r324）；缺省 type 取注册表默认（r467）；行级 `generation_meta` 落库并随序列化回传（r326）；未知 output type → 400 且 `details` 携带 `outputType` 与 `supported` 列表（r166 改写后的可测行为）。
- **DB 迁移 0007**：`outputs.generation_meta`（json text）；`prompt_presets.generation_type_id`（默认 'qa'）。
- **web**：全部 qa/outputs 生成调用点补 `generationTypeId`（eden 类型驱动，typecheck 兜底）。
- **specs 收口**：typed-gen 4 条 bare + presets-constraints 3 条 bare 全部场景化；r323/r325/r327/r328 视可程序判定口径升格；r166 改写为静态注册表现实；r423 改写（退役全局特性开关词汇——builtin 恒可用，确定性不依赖配置）；r22 去除「when enabled」从句；**data-and-storage r50 移除**（c14 架构决策取代：wire 类型走 Eden + shared Zod，drizzle 类型不外溢）。

## Impact

- **破坏性 wire 变更**：qa/outputs 生成请求必填 `generationTypeId`。消费方仅本仓 web（同仓同批更新）；BDD qa/outputs 域本就 SKIP。无外部 client，无迁移脚本需求。
- **行为修复**：r23/r25 两处既有违约转为守约（未知/禁用预设从静默回退改为确定性 400）。
- pending 94 → 82（12 条 bare 收口）；C 台账按升格情况同步核减。
- `migrations/` 升级路径：无外部部署方消费该 wire 字段，不适用。
