## Why

插件（connectors/parsers/outputs/slides/extractors）是 Crystalith 的扩展能力来源，但它们也是最容易让体验“碎掉”的地方：依赖缺失、环境不对、版本不兼容，最后落到用户这边就是一个 ImportError 或者一个模糊的“失败”。

我们需要一套可执行的 plugin health 契约：插件能不能用、为什么不能用、怎么修复，都要说得清楚。

## What Changes

- 定义插件元数据与自检接口（最小集合）：
  - `name`/`version`/`capabilities`/`requires`（依赖与外部服务）
  - `readiness_check()`（返回 status + reason + recovery_hint）
- 引入 smoke test harness：
  - 本地/CI 都能跑：加载插件、执行最小自检、输出结构化结果
  - 对“官方插件集”提供一键检查入口
- 产出兼容矩阵（compat matrix）：
  - 在不同 profile（local/hybrid/docker/full）下，哪些插件默认可用、哪些需要额外 overlay/依赖
  - UI 展示以“能用/不能用/怎么修”为核心，不做花哨图表

## Capabilities

### New Capabilities

- `plugin-health-and-compat`: 插件元数据、自检接口、smoke test 与兼容矩阵的契约。

### Modified Capabilities

- `official-plugins`: 官方插件的最小自检要求与版本约束。
- `architecture-plugin-and-agent`: 插件加载、隔离边界与故障降级策略。
- `fullstack-plugin-bundles`: 前端/后端插件 bundle 的构建与健康检查挂钩方式。
- `delivery-and-deployment`: smoke test 在 CI/本地的标准入口与失败信息规范。

## Impact

- Backend：PluginRegistry 会更可控；插件故障不会轻易把主流程拖死。
- Frontend：插件列表可以展示“为什么不可用”，而不是简单灰掉。
- Dependencies：建议先有 `c14` 的 profile/配置可解释输出，再用它来解释“插件为何不可用”。

## Dependency Sketch

```mermaid
flowchart TD
  REG[Plugin registry] --> META[Metadata]
  META --> CHECK[readiness_check()]
  CHECK --> RES[Health results]
  RES --> CI[CI smoke tests]
  RES --> UI[UI compat matrix]
  UI --> ACTION[Install deps / enable overlay / upgrade plugin]
```
