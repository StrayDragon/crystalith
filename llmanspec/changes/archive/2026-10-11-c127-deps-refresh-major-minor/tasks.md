# Tasks — c127-deps-refresh-major-minor

> 每批次完成后跑 `just qa`（含 fallow 双门禁）。批次间 commit 分段，禁止跨批混提交。
> 升级操作纪律（用户修正）：**优先 `bun update <pkg>` / `bun upgrade`**（bun 自己解析兼容版本并落 lockfile），不要手改 package.json 版本号再 install——手改易造 pin 与解析图分叉。
> 例外：`@ai-sdk/*` 六件套锁步时可用 `bun update` 加范围约束（`bun update @ai-sdk/anthropic@4` 之类），保持六件同批同源。
> c127 前事故复盘：那次是裸 `bun add <pkg>`（无版本）触发全量重解析漂移；`bun update <pkg>` 只动目标子树，语义不同，安全。
> 红批遇阻降级规则：单项超 1 天工时或引入行为回归 → 记 `docs/known-issues.md`，裁出本 change。

## Batch G — 绿批 patch/minor（无 breaking）

- [x] G1 锁步升 `ai` 7.0.137 + `zod` 4.6.5（三 workspace）；附带：`@ai-sdk/provider` pin 放宽 `^4.0.26` 消除双版本 hoist（4.0.2/4.0.26 并存即上批 30 错根源）
  - 验证：`bun run typecheck` + `just test` + `just test-web`
- [x] G2 `elysia` 1.4.30 / `@elysiajs/openapi` 1.4.16 / eden 随动；typecheck 0 错、server 630 + web 421 全绿
- [x] G3 drizzle 0.45.4 / kit 0.31.11；check-app-schema up-to-date、drizzle-kit check fine、server tests 绿
- [x] G4 platejs 家族 53.3.x 锁步；typecheck 0 错、web 421 全绿
- [x] G5 xyflow/radix/testing-library/msw(2.x)/yaml 杂项；typecheck+双测全绿
- [x] G6 oxlint 1.87（204 rules）/oxfmt 0.72；新规则增量告警 12→0：zod const 改 *Schema 惯例（fetch/retrieve/web-search）、ErrorCode/EnvTarget 拆 value·Key 双名、LabFlowNode→LabFlowNodeView、regex +u、toSorted、测试具名 import、rstest.setup Tier1 disable
- [x] G7 批次门禁全绿；连带：fallow audit 新规则暴露的 3 个组件拆分（LabFlowNodeView 提 nodeVisual 系纯函数 + LabNodeStatusFooter，cyc 29→11/8）与 CRAP 估算 inline 豁免（coverage 集成后移除）

## Batch Y — `@ai-sdk/*` 六件套锁步（核心适配）

- [x] Y1 六件套 → 4.0.78/3.0.63/4.0.93/4.0.91/3.0.67/provider ^4.0.26（range 锁步；registry 实核 latest）；typecheck 0 错——**V4 签名兼容，cast wall 零改动**
- [x] Y2 无需适配：上游 V4 ABI 本轮未变；`resolveChatModel` 三分支 cast 原样通过。normalize 函数预留至真 breaking 出现（design 已备）
- [x] Y3 provider mock 全套绿 / check-provider-deps OK / preflight smoke 至「模型未配置」（import 链完整，见 5ee81778）
- [x] Y4 type-aware 过签（3 err 前存 Tier1，R8 记录）；just qa 绿；cast wall 零改动收敛（5ee81778）

## Batch R — 大版本（逐项评估，允许裁剪降级）

- [x] R1 spike 完成→**裁延**：v4 需 css-first 重写+scrollbar4 连动+Layer/!important 回归，超 1 天阈值；known-issues 已登记
- [x] R2 @mui icons+material 配对 9.5.0；46 文件 API 不变，web 421 绿
- [x] R3 msw 3.0.3；onUnhandledRequest→onUnhandledFrame 改名适配，门面/test 不变
- [x] R4 jsdom 30 双 workspace
- [x] R5 gridstack 14：float→mode:'top'、init 可空守卫、addWidget el 守卫；630/421 绿
- [x] R6 gpt-tokenizer 4；encode/decode 默认路径不变，server 全量绿
- [x] R7 zod-to-openapi 9.1；check-app-schema up-to-date + openapi 测试绿（无 drift）
- [x] R8 tsgolit 7（advisory 3 err 前存 Tier1）；scrollbar4 需 tw4→随 R1 顺延
- [x] R9 每项独立 commit；just qa 全绿（31 e2e 含）

## 收尾

- [x] F1 lock 收敛；provider 单一 hoist 4.0.26（4.0.2 仅磁盘缓存残留，lock 无引用）
- [x] F2 余量：ipaddr 2.5(patch,随下次)、tw4/scrollbar4/tsgolit 债 → known-issues 登记完毕
- [x] F3 已登记（含恢复/删除条件）
- [x] F4 终局 qa 绿 → verify → finalize（本条勾选即收口前置完成）
