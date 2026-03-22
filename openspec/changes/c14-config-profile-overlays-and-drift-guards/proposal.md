## Why

现在的配置已经能用，而且还挺灵活：`config/app.yaml` + secrets + overlay，再加上一堆 env var。问题是灵活到一定程度，就会出现“我到底在用哪份配置”的困惑——尤其是在 local/hybrid/docker/full 之间切换时，踩坑基本都集中在这里。

如果配置加载顺序、profile 能力边界、以及 schema/drift 的门禁不先定清楚，后面任何稳定性工作都会被“配置漂移”反复拖后腿。

## What Changes

- 把配置加载与覆盖顺序写成稳定契约，并暴露可检查的“有效配置”（不含敏感字段）：
  - 基础配置：`config/app.yaml`
  - overlay：`app.local.yaml`、`app.{env}.yaml`、`app.{env}.local.yaml`（与代码一致）
  - secrets：`config/secrets.yaml`（或 `CRYSTALITH_SECRETS_PATH` 指向的文件）
- 引入 profile 概念（local/hybrid/docker/full），每个 profile 明确：
  - 必需/可选服务
  - 默认启用的插件/功能集
  - 运行成本与退化策略（关联 `c17`）
- 增加 drift guard：
  - 配置 schema 的 SSOT 与生成入口：以 Settings/Config 模型为 SSOT，生成命令为 `cd backend/py && just config-schema`（产物：`config/app.schema.gen.json`）。
  - 启动时必须 validate：校验失败要给出“哪一层覆盖导致的”信息（不再只报一段 ValidationError）。
- 提供“配置差异解释”：能对比两个 profile/两份 overlay 的差异，并说明哪些差异会影响能力（为排障服务，而不是做 UI 花活）。

## Capabilities

### New Capabilities

- `config-profile-overlays`: 配置层级、profile、有效配置输出与差异解释的契约。

### Modified Capabilities

- `config-and-models`: Settings/Config 的字段语义、默认值与敏感字段标记规则。
- `service-composition-profiles`: profile 的能力边界与可选服务组合（与 `c17` 强关联）。
- `delivery-and-deployment`: drift gate 的命令入口与 CI/本地开发的最低校验清单。

## Impact

- Backend：配置加载、校验与错误信息会更“可读”；本地开发会少掉大量玄学问题。
- Frontend：如果需要展示 profile/能力信息，会更容易做（来源更可靠）。
- **Generated artifacts**：涉及 `config/app.schema.gen.json`，必须明确生成入口与 drift check，避免手改。

## Dependency Sketch

```mermaid
flowchart TD
  ENV[Env vars] --> PATH[Locate config/secrets]
  PATH --> BASE[config/app.yaml]
  BASE --> O1[app.local.yaml]
  O1 --> O2[app.{env}.yaml]
  O2 --> O3[app.{env}.local.yaml]
  O3 --> SEC[secrets.yaml]
  SEC --> VAL[Schema validate]
  VAL --> EFF[Effective config (redacted)]
  EFF --> PROF[Profile capability view]
```
