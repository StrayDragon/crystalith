## Context
- 后端已能导出 OpenAPI JSON（`backend/py/scripts/api_schema.py`），前端也已有 OpenAPI 同步流程。
- 目标是将 SDK 维护成本降到最低：由 OpenAPI 自动生成并在发布时自动推送。
- 需要评估 OpenAPI/AsyncAPI 生成器与 Python 版本兼容性，并明确 SDK 生成产物在仓库内的落位。

## Goals / Non-Goals
- Goals:
  - 选择稳定、维护成本低的 Python SDK 生成器，并与现有 OpenAPI 3.1 文档兼容。
  - 提供手动触发的发布流程，不在 `v*` tag 上自动触发。
  - SDK 包名优先与项目同名，并明确 Python 版本支持范围（>= 3.10）。
  - SDK 生成物保存在 `sdk/client/python` 便于排查与集中维护。
- Non-Goals:
  - 不在本次变更中引入手写 SDK 逻辑或自定义大量模板。
  - 不在缺少稳定模板时强行上线 AsyncAPI 事件 SDK。

## Decisions
- Decision: OpenAPI 生成器优先采用 `openapi-python-client`。
  - Why:
    - 本地试验可完整生成当前 OpenAPI 3.1 文档的 SDK（见实验记录）。
    - 提供同步/异步 API、类型模型拆分清晰，且可通过配置覆盖包名/项目名/版本。
  - Evidence:
    - 生成器文档与配置能力见官方仓库说明（支持 `project_name_override`/`package_name_override` 等）。
- Decision: SDK 生成产物落位于主仓库 `sdk/client/python`，由 CI 覆盖生成，不手工编辑。
- Decision: PyPI 发布优先使用 Trusted Publishing（OIDC），如无法配置则回退 API token。
- Decision: PyPI 包名优先使用 `crystalith`（2026-01-29 查询未占用），后备 `crystalith-sdk`。
- Decision: 暂停 tag 自动发布，改为手动触发发布流程。
- Decision: 暂不采用 `openapi-generator` 生成 Python SDK。
  - Why:
    - 官方声明 OpenAPI 3.1 支持仍处于 beta；本地试验对当前 schema 生成失败。
- Decision: AsyncAPI 事件 SDK 暂缓。
  - Why:
    - 官方 AsyncAPI 模板列表包含 Python（paho）模板，但该模板与当前 generator 版本不兼容；且 baked‑in 模板被标记为实验阶段。

## Alternatives considered
- `openapi-generator` Python client:
  - 优点：生态成熟、模板多。
  - 缺点：OpenAPI 3.1 支持为 beta；本项目 schema 在生成时出现类型解析异常。
- `Kiota`:
  - 优点：多语言统一工具链。
  - 缺点：需要额外 .NET 工具链，且对现有 Python 依赖/结构改造较多。
- `AsyncAPI Generator`（python-paho-template）:
  - 优点：官方模板。
  - 缺点：模板兼容版本限制导致无法在最新 generator 上生成。
- 独立 SDK 仓库 + submodule:
  - 优点：SDK 与主仓库分离，可独立发布。
  - 缺点：开发排查分散、发布需要跨仓库同步。

## Risks / Trade-offs
- OpenAPI 3.1 兼容性：选择 `openapi-python-client` 以规避 openapi-generator 当前的 3.1 风险。
- SDK 版本策略需与后端 tag 对齐，否则会产生 PyPI 版本不一致。
- AsyncAPI 事件 SDK 需要等待模板/工具链兼容或采用自维护模板。
- CI 在 tag 后生成并提交产物可能引入额外提交，需要明确流程与权限配置。

## Migration Plan
1. 生成器选型与配置落地（含包名/版本覆盖、Python >= 3.10）。
2. 确定 SDK 生成目录 `sdk/client/python` 并标记为生成产物。
3. 增加手动触发的 GitHub Actions：校验版本 → 构建产物 → 发布 PyPI。
4. 补充 SDK 使用说明与发布流程文档。

## Open Questions
- AsyncAPI 是否已有稳定事件协议文档，还是需要先制定 AsyncAPI 规范？
