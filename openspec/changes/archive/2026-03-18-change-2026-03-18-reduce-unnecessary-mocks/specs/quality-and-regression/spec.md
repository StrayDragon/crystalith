# quality-and-regression Specification

## ADDED Requirements

### Requirement: Tests minimize brittle mocks and align with real implementations
后端测试 MUST 尽可能对齐真实实现与真实 wiring，并避免通过 patch 内部实现细节来达成可控性；当确需可控时，系统 MUST 提供显式 seam（依赖注入、可替换 provider/transport）供测试使用。

#### Scenario: Test controls external dependencies via explicit seams
- **WHEN** 测试需要隔离网络/第三方服务/宿主环境等外部边界
- **THEN** 测试 SHALL 使用显式 seam（例如 transport/provider/clock）进行隔离
- **AND** 测试 SHALL 避免 patch 私有符号（`_xxx`）来替换内部实现

#### Scenario: Backend quality gate rejects private patches
- **WHEN** 开发者运行后端默认质量门槛（例如 `cd backend/py && just test`）
- **AND** 测试代码存在对私有符号（`_xxx`）的 patch
- **THEN** 质量门槛 SHALL 失败并给出可定位的诊断信息（不允许 allowlist）

### Requirement: Test-double usage is observable via a stable report
仓库 MUST 提供稳定的 test doubles 使用报告入口，以便识别 brittle mocks、热点文件与迁移目标，并支持本地与 CI 环境复现。

#### Scenario: Developer can run a deterministic report
- **WHEN** 开发者运行后端测试替身使用报告入口（例如 `just test-mock-report`）
- **THEN** 系统 SHALL 输出确定性的统计与迁移导航信息（私有 patch、缺少 `Mock reason:` 的位置、hotspots）
