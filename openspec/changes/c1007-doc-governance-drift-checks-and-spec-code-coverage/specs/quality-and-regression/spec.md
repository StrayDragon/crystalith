# quality-and-regression 规范增量

## ADDED Requirements

### Requirement: CI provides coverage artifacts and optional PR summaries
CI SHOULD 产出可消费的覆盖率信号，以便在不追求机械 KPI 的前提下观察回归风险。

#### Scenario: Coverage artifacts are uploaded
- **WHEN** CI 完成后端/前端测试
- **THEN** CI SHOULD 上传 coverage artifacts（backend + frontend）

#### Scenario: PR summary is visible (optional)
- **WHEN** 覆盖率摘要功能启用
- **THEN** CI MAY 在 PR 上提供覆盖率摘要（例如总覆盖率与变化趋势）

### Requirement: CI performs dependency vulnerability scanning
CI SHALL 对 Python 与 Node.js 依赖执行漏洞扫描，并同时支持 PR 触发与定时扫描。

#### Scenario: PR triggers vulnerability scan
- **WHEN** 开发者创建或更新 PR
- **THEN** CI SHALL 执行依赖漏洞扫描并报告结果

#### Scenario: Scheduled scan runs weekly
- **WHEN** 到达每周定时窗口
- **THEN** CI SHALL 运行漏洞扫描并产出可消费输出（artifact 或等价形式）

### Requirement: CI caches dependencies for faster feedback
CI SHOULD 启用依赖缓存以缩短执行时间，缓存至少覆盖 Python（uv cache）与 Node.js（pnpm store）。

#### Scenario: Cache is used for subsequent runs
- **WHEN** CI 重复运行且依赖未变化
- **THEN** CI SHOULD 命中依赖缓存并减少安装耗时

### Requirement: Branch protection guidance exists for required checks
仓库 SHOULD 提供分支保护与 required checks 的落地建议，确保 CI 门禁不是“口头约定”。

#### Scenario: Main branch rejects direct pushes
- **WHEN** 尝试直接推送到 main 分支
- **THEN** 平台侧 SHOULD 拒绝推送并提示需要通过 PR 合并

#### Scenario: Required checks block merge
- **WHEN** PR 的 required checks 未全部通过
- **THEN** 合并入口 SHOULD 被阻塞
