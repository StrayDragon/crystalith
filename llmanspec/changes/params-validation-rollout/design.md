# Design — params-validation-rollout

## D1 事实核查（2026-08-23，运行时探针 + 全量 grep）

| 事实                    | 证据                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| body 校验失败现状       | `POST /v2/notebooks {name:123}` → **422** `SCHEMA_VALIDATION_FAILED`（onError VALIDATION 分支）                                           |
| params 挂载后行为       | `GET /v2/notebooks/abc` → **422** 同信封（试点实测）                                                                                      |
| 手工解析现状行为        | `400 INVALID_REQUEST`（shared/ids.ts requirePositiveIntId）                                                                               |
| spec 是否钉住校验错误码 | `SCHEMA_VALIDATION_FAILED` 零提及；`INVALID_REQUEST` 仅出现在业务状态机场景（r316 prune、domain-errors 条目），均走 AppHttpError 不受影响 |
| r244「稳定的 404/400」  | 覆盖 ownership 场景（资源不存在/不属于）→ 保持 404，不受本变更影响                                                                        |
| 试点回归                | notebooks 三路由挂载后 380 tests green                                                                                                    |

## D2 归一策略决策：采用 422 统一（Option A）

| 备选                                                          | 结论                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A. 统一 422**（params 挂 schema，接受与 body 一致的行为）   | ✅ **采纳**。消除双轨；与现有 body 行为天然一致，无新增特判                  |
| B. onError 把 params 类 VALIDATION 特判回 400 INVALID_REQUEST | ✗ 引入「按 schema 位置分流错误码」的隐式规则，维护成本高且与 body 行为不一致 |
| C. 维持手工解析现状                                           | ✗ 双轨持续腐化；97 处样板；Eden params 类型停留 string                       |

## D3 铺开模式

每个 router：

```ts
const NidParams = z.object({ nid: z.coerce.number().int().positive() });
// 路由 options 增加 params: NidParams；handler 直接用 params.nid（number）
```

- 多参数路径扩展为 `{ nid, ... }` 组合对象；`:rid` 等同理
- `requirePositiveIntId` / `requireOptionalPositiveIntId` 保留：query 场景（如 `?sourceId=`）
  与需要 INVALID_REQUEST 文案的业务入口继续使用
- 迁移顺序：sessions → sources → studio → outputs → 其余（按手工调用数从多到少，每步跑全量测试）

## D4 specs landing

workspace-api-contract 增补一条 requirement（ADDED）：
「path/query 参数格式非法 MUST 返回统一 ErrorEnvelope（422 SCHEMA_VALIDATION_FAILED）；
资源不存在或不属于该 notebook MUST 保持 404」——把 body/params 的统一验证语义写成当前态，
并与 r244 ownership 语义划清边界。

## 回滚边界

纯路由 schema 挂载 + handler 样板删除；revert 即回滚。wire 变化仅限 bad-id 错误码
（见 BREAKING），业务成功路径与 404 语义零变化。
