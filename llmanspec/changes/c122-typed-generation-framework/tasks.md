# Tasks

- [ ] t1 shared SSOT：新增 `packages/shared/src/schemas/generation-type.ts`（id 词汇/类型合约/GenerationMeta/QaControls/preset 扩展）；`qa-stream.ts` 请求+响应字段；`output.ts` generate body 与 OutputSchema；`prompt-presets` 共享 schema 加 generationTypeId；barrel 导出。验证：`bun typecheck`（shared）通过。
- [ ] t2 [blocked-by: t1] server 注册表与 qa 链：`features/generation-types/`（registry + GET /v2/generation-types + openapi tag）；qa 装配（generationTypeId 校验/预设白名单合并解析/custom 消费/控制项注入/generation 回传/r422 裸指令 400）。验证：新 `tests/generation/generation-types.test.ts` + `tests/qa/preset-resolution.test.ts` 全绿。
- [ ] t3 [blocked-by: t1] server outputs 链与迁移 0007：generationTypeId 校验、type 缺省 PARAGRAPH、generation_meta 落库回传、未知类型 400 details{outputType,supported}；db schema + `drizzle/0007_*.sql` + journal。验证：outputs 相关测试全绿 + 迁移在集成环境自动应用。
- [ ] t4 [blocked-by: t2,t3] web 适配：全部 qa/outputs 生成调用点补 generationTypeId（eden 类型驱动）；受影响 web Rstest 更新。验证：`bun typecheck` + `just test-web` 绿。
- [ ] t5 [blocked-by: t2,t3] specs 收口：typed-gen 7 条 + presets-constraints 3 条场景化；r166/r423 改写、r22 措辞、r50 移除、C 升格核减。验证：`validate --specs --strict` 33/33；review pending 94 → 82。
- [ ] t6 [blocked-by: t4,t5] 回归收口：`just test-bdd` + `just qa` 全绿；作战地图与 C 台账同步（finalize 后 main 提交）。
