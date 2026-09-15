# Design：c65-source-search-error-contract

## 1. Spec 增量（apply 时在绑定分支编辑 live spec）

在 `llmanspec/specs/source-ingestion-upload-and-url/source-ingestion-upload-and-url.feature:66`
条款所属场景内**追加子句**（或紧邻新增场景，以场景粒度现状为准）：

```text
    - POST /sources/search 在搜索引擎不可用或调用失败时 MUST 返回 status='service_error'
      且 message MUST 为用户可读中文文案，MUST NOT 伪装为 'no_results' 或返回空成功响应；
      'no_results' MUST 仅表示引擎正常应答且零命中。前端 MUST 将 service_error 呈现为
      可与「无命中」区分的错误态（含重试入口或重试指引），MUST NOT 将其渲染为普通空结果提示。
```

## 2. wire 契约（shared）

`packages/shared/src/schemas/source.ts:531`：

```ts
export const SourceSearchStatusSchema = z.enum([
  'ok',
  'not_implemented',
  'no_results',
  'service_error',
]);
```

- `SourceSearchResponseSchema` 增补 refine 或约定注释：`status='service_error'` 时 `message`
  非空（用 `.superRefine` 会改变 infer 结构，若 Eden/前端类型受扰则改为 schema 字段
  `.describe(desc(...))` 注明约定 + 路由行为测试兜底；二选一在实现时定，优先注释约定）。
- `errorCode` 字段暂不加：单机产品当前只有一个失败源（SearXNG），message 足够；
  出现第二个引擎时再扩展（YAGNI，避免为未来字段留死契约）。
- 同步检查 `config/app.schema.gen.json` 无需变更（枚举变化会体现在 OpenAPI，属预期衍生物）。

## 3. server

`sources/router.ts` 搜索 handler（:738 附近）：

```ts
} catch (error) {
  logger.error('[sources/search] web search failed:', error);
  return { status: 'service_error', query, engine, mode, results: [],
           message: '搜索服务暂时不可用，请稍后重试。', createdAt: ... };
}
```

- 早返回，MUST NOT 继续走 no_results 收尾逻辑。
- notebook 内向量匹配分支（`not_implemented`/ok 路径）不动。
- 注意该 handler 可能还有「web 模式被禁用」分支——其现有错误语义维持不变，本变更只管
  「引擎配置了但调用失败」。

## 4. web

`useSources.ts:421-433` 的成功分支内先分流 status：

- `service_error` → 队列项 `{ status: 'error', notice: response.message ?? '搜索服务不可用…' }`
  （SearchResultsQueue 的 error 态 UI 已存在，:212，直接复用；若该态缺重试按钮，补一个
  「重试」按钮回调原查询——最小实现，不新建机制）。
- `no_results` / `ok` → 维持现状（success + notice）。
- catch 分支（HTTP 层失败）文案保持「搜索失败，请稍后重试。」不变。

## 5. 风险登记

| 风险                                              | 等级 | 缓解                                                                          |
| ------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| 枚举扩张破坏既有消费者（外部 OpenAPI 用户）       | 低   | 枚举新增成员是向后兼容演化；仓库内消费者仅 web 一处且本变更同步               |
| e2e 断言依赖 no_results 文案                      | 低   | 全仓 grep「没有找到匹配结果」相关 testid/断言，改引擎故障路径用例时区分       |
| service_error 也可能由「引擎返回 0 条且抛错」误判 | 低   | searchWeb 抛错才走 service_error；引擎正常应答零命中仍是 no_results，单测锁死 |

## 6. 测试计划

- server 单测：mock searchWeb reject → `status='service_error'` + message 非空 + results 空；
  mock 返回空数组 → 仍为 `no_results`（关键对照）。
- web Rstest：service_error 响应 → 队列项 error 态 + 服务端 message；重试按钮触发原查询。
- `just qa` 全绿（含 OpenAPI 衍生物漂移门禁）。
