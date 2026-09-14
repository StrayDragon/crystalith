---
depends_on: []
---

# 来源网页搜索错误契约：引擎不可用与无结果可区分

> 2026-09 阶段性 QA 产物。spec 归属已核实：`source-ingestion-upload-and-url.feature:66` 只约定「POST /sources/search MUST 调用 SearXNG 返回真实 web 结果、MUST NOT 返回向量匹配 placeholder」，**未约定失败语义**——引擎不可用被伪装成 no_results，需要新增 MUST 条款，故走 SDD。

## Why

**1. 引擎故障在服务端被吞成「无结果」。**

`apps/server/src/features/sources/router.ts:738-749`：`searchWeb` 抛错（SearXNG 宕机/超时）
被 catch 后仅 logger.error，循环不再追加结果，响应最终以 `status:'no_results'` 返回。
HTTP 契约上「搜索服务不可用，请重试」与「真的没有命中」不可区分。

**2. 前端两级失真，用户被误导为「没搜到」。**

`apps/web/src/features/workspace/domains/sources/useSources.ts:417-433`：web 端**从不消费**
wire 的 `response.status`（`SourceSearchStatusSchema` 的 ok/not_implemented/no_results 三值
零消费，grep 证实），notice 只看 `results.length`——引擎故障最终呈现为「没有找到匹配结果」。
用户面对误导性文案，既不知道该重试，也不知道该去检查 SearXNG 配置。

搜索导入是来源入口的三条主路径之一（上传/URL/搜索），这条失败面直接挡住用户导入。

## What Changes

- **wire 契约（shared，需 spec 修正）**：`SourceSearchStatusSchema`（`packages/shared/src/schemas/source.ts:531`）新增 `'service_error'` 成员，语义为「搜索引擎不可用/失败」；约定 service_error 时 `message` MUST 为用户可读中文文案，`results` 为空数组。既有 ok/not_implemented/no_results 语义不变。
- **server**：`sources/router.ts` 搜索 catch 分支返回 `status:'service_error'` + 可读 message（保留 logger.error），MUST NOT 再落入 no_results。
- **web**：`useSources.ts` 搜索链路消费 `response.status`——`service_error` 映射为队列项 error 态（notice 用服务端 message，提供「重试」语义）；`no_results` 维持 success + 「没有找到匹配结果」。
- **spec 增量（source-ingestion-upload-and-url）**：引擎不可用 MUST 返回可区分的 service_error，MUST NOT 伪装成 no_results；前端 MUST 呈现可区分的错误态（区别于无命中）。

## 证据快照（2026-09-14）

| 证据                                             | 位置                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| catch 吞错 → 空结果 → 契约上等同 no_results      | `apps/server/src/features/sources/router.ts:738-749`                    |
| status 枚举（新增 service_error 的落点）         | `packages/shared/src/schemas/source.ts:531-537`                         |
| web 从不读 `response.status`，notice 只看 length | `apps/web/src/features/workspace/domains/sources/useSources.ts:421-433` |
| 既有条款（本变更在其上补失败语义）               | `source-ingestion-upload-and-url.feature:66`                            |

### 证据刷新方法（apply 开头再跑一次）

```bash
grep -rn "response?.status\|response.status" apps/web/src/features/workspace/domains/sources/
grep -n "'service_error'" packages/shared/src/schemas/source.ts
```

若 web 已消费 status → 前端部分缩小为对齐文案；若枚举已含 service_error → 关闭对应任务。

## 非目标

- 不改搜索结果队列的 UI 结构（SearchResultsQueue 已有 error 态样式，直接复用）。
- 不做自动重试/退避（用户手动重搜即可；与 `c64-research-lab-sse-resilience` 的自动重连是不同场景）。
- 不动 research 侧对 searchWeb 的复用（`deep-research-runtime.feature:22` 的复用条款不受影响；research 侧对引擎失败的容忍语义已有独立条款 r158 管）。
