# Tasks — source-search-error-contract

> Seam：
> ① `bun test apps/server/tests/`（search 契约）
> ② `just test-web`（队列映射）
> ③ `just qa`（收口；OpenAPI 衍生物门禁覆盖枚举变化）
>
> spec 编辑（T0）必须在绑定分支上进行。改动面小，单 PR 一次收口。

## T0 live spec 增量

- [ ] 按 design §1 在 `source-ingestion-upload-and-url.feature:66` 场景追加 service_error 子句
- [ ] `llman sdd validate` 绿
- 验证：validate 无 unbound/漂移告警

## T1 shared wire 契约 [blocked-by: T0]

- [ ] `SourceSearchStatusSchema` 增 `'service_error'`；`SourceSearchResponseSchema` 按 design §2 注明 message 约定（不引 errorCode）
- [ ] `bun typecheck` 绿（Eden 推断联动确认）
- 验证：`bun typecheck`；`bun run check-app-schema`（若枚举进 config 门禁面）

## T2 server 行为 [blocked-by: T1]

- [ ] `sources/router.ts` 搜索 catch 分支早返回 `service_error` + 可读 message，保留 logger.error
- [ ] 单测：引擎抛错 → service_error；引擎零命中 → 仍 no_results（对照用例）
- 验证：`bun test apps/server/tests/` 绿

## T3 web 映射 [blocked-by: T1]

- [ ] `useSources.ts:421-433` 消费 `response.status`：service_error → 队列 error 态 + 服务端 message；补 SearchResultsQueue error 态的「重试」按钮（回调原查询）
- [ ] Rstest：service_error → error 态；no_results → success + 「没有找到匹配结果」
- 验证：`just test-web` 绿

## T4 收口

- [ ] `just qa` 全绿 → `llman sdd change finalize`
