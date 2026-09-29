# Design — C/H 移除 + G 场景化

## 移除判定证据

| req  | 规则                      | 证据                                                                                                     | 处置                           |
| ---- | ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| r176 | 生成请求 traceId 贯穿日志 | `traceId` 在 qa/outputs/rag/ai 链路零命中（仅 studio c51 slides 专属）                                   | 移除                           |
| r177 | 阶段耗时标准化字段        | durationMs/elapsedMs 等字段在 rag/qa 零命中                                                              | 移除                           |
| r178 | errorKind 日志字段        | `errorKind` 零命中（c57/c42 的错误分类存在，但规则的「日志记录标准字段」无实现；分类行为由其他条款承载） | 移除                           |
| r179 | cache hit/miss 日志       | cache.ts 无 hit/miss 记录                                                                                | 移除                           |
| r182 | 后台 worker 优雅停机      | v2 无任务队列（pipeline 有意同步，c123 确认）；前提不存在                                                | 移除                           |
| r345 | 可选 API key 鉴权         | `auth.enabled` 死字段零消费；server.ts:235 "v2 has no auth yet"                                          | 移除（连带清理 config 死字段） |

## G 组锁测设计（tests/config-governance.test.ts，新）

| req | 断言                                                                                                                                                                                                                                          | 依据实现                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| r30 | 同键并存时 CL_* 覆盖 YAML（storage.data_root 场景：yaml 设 ./data_local + CL_DATA_ROOT=/tmp/x → getDataRoot()=/tmp/x）；无 env 时回退 YAML                                                                                                    | config-env 优先级合并                                         |
| r32 | 三段流水线：模板渲染失败（未定义 env 引用）/YAML 语法错误/schema 校验失败均抛可读错误且不产出半成品配置                                                                                                                                       | loadConfig 三段实现（config.test.ts 已锁模板渲染 happy path） |
| r34 | getDataRoot 从 storage.data_root 派生且 slides/uploads/content-storage 子路径均由其 join 派生；CL_DATA_ROOT 覆盖生效                                                                                                                          | getDataRoot + 各 DEFAULT_BASE                                 |
| r37 | 同一 env+yaml 两次 loadConfig 结果 deep-equal；secret.env 缺失仅警告不改变结果                                                                                                                                                                | 纯函数加载                                                    |
| r38 | resolveMigrationsFolder 源码树解析命中 drizzle/；resolveSqliteVecNativePath 在 native/ 缺席时回退包解析（返回 null 或包内路径，不抛）；resolveWebDistRoot 缺席 → headless（server 仍启动——web-static.test 已锁 CL_WEB_DIST 命中面，补缺席面） | db/index.ts + web-static 导出                                 |
| r16 | extractor 与 slides-workflow 内置插件经同一 PluginRegistry 注册路径生效（registry.test 既有覆盖的合约面）；types.ts 单一 CrystalithPlugin 形状                                                                                                | plugins/registry.ts                                           |

实现注记：r30/r34/r37 用 `resetConfig`/env 注入 + `afterEach` 还原（隔离纪律）；r38 的解析函数为纯路径计算，直接单测；r16 以 registry 单测断言注册路径唯一性（不重复造套件，锚定既有 registry.test 补 kind 覆盖面断言）。

## 移除的连带清理

- `config-settings.ts`：删 `auth` 段（schema + desc）。
- `packages/shared/src/i18n/zh/index.json`：删 `app.auth.enabled` key。
- `config/app.schema.gen.json` 门禁会因 schema 变化要求重新生成（`bun scripts/gen-app-schema.ts`）。
