# quality-and-regression 规范增量

## MODIFIED Requirements

### Requirement: API/codegen/schema drift checks are mandatory
CI MUST 检查 OpenAPI、生成客户端、配置 schema、docs 受控生成物/注入区块与导入分层一致性。

#### Scenario: Drift causes CI failure
- **WHEN** OpenAPI/生成客户端/配置 schema/docs 受控生成物/注入区块/导入分层与仓库内容不一致
- **THEN** CI SHALL 检测到漂移并失败提示

### Requirement: Frontend formatting uses Oxfmt with generated files excluded
前端格式化工作流 MUST 使用 `oxfmt` 提供统一写入与检查入口，并排除生成产物与第三方内容。

#### Scenario: Format check targets hand-authored frontend files only
- **WHEN** 开发者运行 `pnpm -C frontend/web run format:check`
- **THEN** 系统 SHALL 使用 `oxfmt` 校验前端手写源码与关键配置文件的格式
- **AND** SHALL 排除 `src/api/generated/**`、`openapi.gen.json`、lock 文件与 vendor 内容

#### Scenario: Full frontend format converges repository style
- **WHEN** 仓库首次引入 `oxfmt`
- **THEN** 迁移 SHALL 对受管前端文件执行一次全量格式化收敛
- **AND** 后续变更 SHALL 可通过 `format:check` 稳定复现相同结果
