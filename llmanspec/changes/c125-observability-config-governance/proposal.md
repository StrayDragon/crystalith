---
depends_on: []
---

# C/H 无实现 spec 移除 + G 配置治理场景化锁测

## Why

用户指令（2026-09-29）：处理 C（可观测性 5）/ G（配置治理 6）/ H（鉴权 1）三组，**代码没有实现的移除不符合的 specs**。逐条代码核查判定：

- **C 组 5 条全部零实现 → 移除**：`traceId`/`errorKind` 字段名、阶段耗时字段、cache hit/miss 日志在生成/检索链路全部零命中（studio c51 的 traceId 是 slides 专属，不构成对应）；r182 的前提「后台任务队列 worker」在 v2 不存在（c123 已确认 pipeline 有意同步）。观测类条款若未来实现，届时新立 capability。
- **H r345 → 移除**：config schema 存在 `app.auth.enabled` 死字段（`config-settings.ts:76`）但服务端零消费——`server.ts:235` 注释明示 "v2 has no auth yet (c13 scope)"，安全鉴权属 spec-ahead 且无排期。死配置字段随条款一并清理。
- **G 组 6 条全部有实现 → 场景化+锁测**：config-env（CL_* 优先级链）、三段加载流水线、getDataRoot 派生、确定性加载、resolveMigrationsFolder/resolveSqliteVecNativePath/resolveWebDistRoot（r38 三项分发语义均有导出函数且 web-static.test 已锁 web 一项）、CrystalithPlugin registry（plugins/registry.test 既有基础）。

## What Changes

- **移除**（generation-observability-and-guardrails）：r176（traceId）/r177（阶段耗时）/r178（errorKind 日志）/r179（cache hit/miss）/r182（优雅停机）。r180/r181/r183/r184（重试边界与守卫）有实现且有场景，保留不动。
- **移除**（workspace-api-contract）：r345（可选 API key 鉴权）+ `config-settings.ts` 的 `app.auth` 死配置段（含 i18n key）。
- **场景化+锁测**（configuration-governance + architecture-plugin-and-agent）：r30（CL_* 覆盖 YAML 的优先级链）/r32（三段流水线失败即抛）/r34（data_root 统一派生 + CL_DATA_ROOT 覆盖）/r37（确定性 + secret.env 缺失不变行为）/r38（迁移目录/sqlite-vec native/web-dist 三级解析与 headless）/r16（CrystalithPlugin 单一 registry 承载 extractor/slides-workflow 内置注册）。
- pending 59 → 47（6 移除 + 6 场景化）。

## Impact

- 纯减法 + 测试；无 wire/行为变更（`app.auth` 字段从未有消费者）。
- 观测能力与鉴权若列入产品路线，需先实现再立 capability（原则：spec 跟随代码）。
