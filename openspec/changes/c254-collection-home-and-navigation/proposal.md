## Why

collection 一旦存在，用户自然会问两个问题：我现在在哪个 collection？这个 collection 最近发生了什么？如果没有一个清晰的“collection home”，collection 就会退化成一个隐藏的筛选条件——用得到的时候找不到，用不到的时候又忘了它存在。

`c249` 定义了对象模型，`c253` 让检索/生成理解 scope；这份 change 把“日常使用的入口和导航”补上，让 collection 真正像一个工作现场，而不是一个标签。

## What Changes

- 增加 collection home 页面（v1 只做最小可用）：
  - 绑定的 notebooks 列表 + 快速打开
  - 最近 sessions/outputs（跨 notebook 聚合，但保留 notebook 归属）
  - collection health 摘要：来源新鲜度、失败导入、重复来源等（对齐 `c03`、`c220`、`c226` 的信号）
  - 快捷动作：在 collection 下发起提问/研究（跳到 `c253` 的入口）
- 增加全局导航与 deep link 规则：
  - 顶部/侧边增加 collection switcher（与 notebook switcher 并列）
  - 支持从任何对象回溯其 collection（若对象属于某 collection scope）
- 与“下一步动作”能力对齐：
  - 允许在 collection home 里展示“推荐下一步”（引用 `c21` 的语义，但保持克制，不做骚扰式提示）

## Capabilities

### New Capabilities

- `collection-home-and-navigation`: collection 的默认入口、聚合摘要与导航契约。

### Modified Capabilities

- `multi-notebook-collections`（`c249`）：需要补齐 collection home 所需的聚合接口（recent activity/health summary）。
- `workspace-ui-core`：新增 collection 路由、导航装配与 switcher 组件。
- `workspace-ui-panels`：各面板需要能在 collection scope 下正确 deep link。
- `proactive-recommendations-and-next-best-actions`（`c21`）：可选复用推荐动作的结构化表达方式。

## Impact

- Frontend：新增 collection home 页面与 switcher；会触及 workspace layout（但尽量只动装配，不动各面板内部逻辑）。
- Backend：需要一个聚合 endpoint（或复用已有的 summary cache）来给 home 页供数。
- Dependencies：强依赖 `c249`；建议与 `c120-workspace-state-projection-and-summary-cache` 联动，避免 home 页变成 N+1 请求地狱。

```mermaid
flowchart LR
  NAV[Global nav] --> SW[Collection switcher]
  SW --> HOME[Collection home]
  HOME --> NB[Open notebook]
  HOME --> RUN[Start run (collection scope)]
  HOME --> REC[Recent activity]
  HOME --> HLTH[Health summary]
```
