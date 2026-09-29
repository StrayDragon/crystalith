# Design — typed-generation-framework 落地

## SSOT 分层

```
packages/shared/src/schemas/generation-type.ts   ← 词汇与合约形状 SSOT（enum/字段/回传形状）
    └──→ apps/server/src/features/generation-types/registry.ts
              ← 描述性元数据注册表（displayName/输入要求/完成语义/允许控制项），
                路由装配与回传都从这里取值；描述不散落在 handler 里
```

词汇（`qa | output | slides`）与合约形状在 shared（web/server 共同消费）；人类可读描述与默认值等行为性元数据在 server 注册表。与「Zod SSOT + Eden」架构一致：shared 管形状，server 管行为。

## 生成类型注册表（server 真相源）

| id       | displayName | inputRequirement                                                                          | allowedOutputTypes                                                                                     | defaultOutputType | completionSemantics                                     | allowedControls                                            |
| -------- | ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `qa`     | 知识问答    | `question` 必填；可选 `sessionId`/`sourceIds`/检索参数                                    | `['MESSAGE']`                                                                                          | `MESSAGE`         | `streamed-answer`（一次性为 `answer`）                  | `lengthHint` / `requireCitations` / `preset` / `directive` |
| `output` | 结构化输出  | `prompt` 或手动 `content`（Studio 手记）；可选 `sourceIds`/`chunkIds`                     | FAQ/GUIDE/TIMELINE/MINDMAP/QUIZ/BRIEFING/PARAGRAPH/BULLETS/STRUCTURED（SLIDES 由 studio 专属端点承接） | `PARAGRAPH`       | `output-row`（同步落库；手动 content 为 `manual-note`） | `preference` / `topK` / `minScore`                         |
| `slides` | 幻灯片      | `prompt` + 来源/大纲；studio 专属端点（无 `generationTypeId` 线上字段，归属由注册表声明） | `['SLIDES']`                                                                                           | `SLIDES`          | `sse-done`（`{traceId, slideId}`）                      | —                                                          |

## wire 形状（shared）

- `GenerationTypeIdSchema = z.enum(['qa','output','slides'])`（请求与回传共用）。
- `GenerationTypeInfoSchema`：`id/displayName/inputRequirement/allowedOutputTypes/defaultOutputType/completionSemantics/allowedControls`（r466 列表端点逐字段对应）。
- `GenerationMetaSchema`（r326 回传）：`{ generationTypeId, outputType, completion, presetId?, effectiveControls? }`。
- `QaControlsSchema`（r186）：`{ lengthHint?: 'concise'|'balanced'|'comprehensive', requireCitations?: boolean }`——prompt 级注入，可程序断言（mock generateText 捕获 system message）。
- `QaNestedRequestSchema`：+`generationTypeId`（必填）+`controls`（可选）；`QaAnswerSchema`：+`generation: GenerationMetaSchema`。
- `OutputGenerateBodySchema`：+`generationTypeId`（必填）；`type` 改可选；`OutputSchema`：+`generationMeta`（可空，来自新列）。
- `PromptPresetSchema`/`PromptPresetCreateSchema`：+`generationTypeId`（可选，默认 `qa`；创建时校验 ∈ 支持 presets 的类型，当前仅 `qa`）。

## 关键行为决策

1. **generationTypeId 必填面**：qa/outputs 两个多类型公共生成面必填（r324「缺失即拒」按字面落地）；studio slides 专属端点不加线上字段（注册表声明归属）——规格措辞按此口径写。
2. **预设解析合并**（r23/r24/r25/r422 一并修复）：解析顺序 = question 指令 > body preset > default。名称解析改为白名单校验：builtin + custom（含 `enabled` 检查）。未知 → 400 `UNKNOWN_PRESET`、`details.availablePresets`；disabled → 400 `PRESET_DISABLED`；裸 `/prompt:<name>`（无 query）→ 400 `EMPTY_PRESET_QUERY`、`details.usage + availablePresets`。custom 命中时以其 `systemPrompt` 渲染（`{{directive}}` 占位与 builtin 同法）。
3. **特性开关退役**（r423 改写依据）：v2 无 `chat_prompt_presets_enabled`，builtin 恒可用；确定性指「同一输入任何部署配置下行为一致」。规格改写而非实现开关。
4. **outputs 默认输出类型**（r467）：`type` 缺省 → 注册表 `defaultOutputType`（`PARAGRAPH`）。手动 content 路径语义不变（显式或缺省的 PARAGRAPH 均进手记分支）。
5. **generation_meta 落库**（r326）：outputs 行级持久（GET 也回传，治理可审计）；qa 响应级回传（答案即消息，不重复建模）。
6. **错误信封**：全部走 `AppHttpError` + `details`（既有 r346 信封），不新增错误通道。

## 迁移 0007（手写 SQL + journal，循 0006 范式）

```sql
ALTER TABLE `outputs` ADD `generation_meta` text;--> statement-breakpoint
ALTER TABLE `prompt_presets` ADD `generation_type_id` text DEFAULT 'qa' NOT NULL;
```

## 测试 seam（全部绑定既有 harness）

- `tests/generation/generation-types.test.ts`（新）：注册表端点合约 + qa/outputs 装配校验 + 回传断言（integration，`setupIntegrationEnv` + ai mock）。
- `tests/qa/preset-resolution.test.ts`（新）：r23/r24/r25/r422 全分支（mock 捕获 system message 断言 custom 覆盖与控制项注入）。
- 既有 `tests/qa/presets-wire.test.ts` 等补 `generationTypeId`；web 调用点由 eden 类型驱动更新，web Rstest 同步。

## 规格收口映射

| 规则                     | 处置                                       | 场景绑定                                  |
| ------------------------ | ------------------------------------------ | ----------------------------------------- |
| r323/r325/r327/r328（C） | 可程序判定者升格场景，其余保持 C 并注明    | generation-types 列表断言                 |
| r324/r326/r466/r467      | 场景化                                     | generation-types.test                     |
| r186/r188/r189           | 场景化                                     | preset-resolution / generation-types.test |
| r166                     | 改写为静态注册表 + details 载荷            | outputs 400 断言                          |
| r422/r423/r24            | r422 实现；r423 改写退役开关；r24 补消费链 | preset-resolution.test                    |
| r22                      | 去「when enabled」从句（锁定规则 WARNING） | 既有 r22 场景保持                         |
| r50                      | 移除（c14 架构取代）                       | —                                         |
