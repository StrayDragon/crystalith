# sdk-distribution Specification

## Purpose

定义 Crystalith SDK 的对外交付闭环：从 OpenAPI 生成到可安装（PyPI/npm）、可版本化（SemVer）、可追溯（Release artifacts）与可回滚（tag/版本策略）。该规范的目标是让外部用户无需克隆仓库即可稳定使用 SDK，并让维护者能以工程化方式发布与验证。

## Non-goals

- 不定义后端业务 API 的字段语义（由现有 API/生成规范覆盖）
- 不一次性覆盖所有语言（Go/Rust 等可后续扩展）
- 不规定具体 SDK 的高层用法教程（但要求示例与入口一致）

## Requirements

### Requirement: SDKs are generated from the same OpenAPI schema
Python 与 TypeScript SDK MUST 基于同一份 OpenAPI schema 生成，并由仓库内可重复的命令产出。

#### Scenario: Generate Python and TypeScript SDK from one schema
- **WHEN** 维护者在同一提交上执行 SDK 生成流程
- **THEN** Python 与 TypeScript SDK SHALL 使用同一份 OpenAPI schema 作为输入

### Requirement: SDK versions are aligned with release tags
SDK 版本 MUST 与发布 tag（`vX.Y.Z`）保持一致，且发布流水线 MUST 校验版本一致性后才允许发布。

#### Scenario: Tag/version mismatch is rejected
- **WHEN** 发布工作流检测到 tag 版本与版本源文件/SDK 版本不一致
- **THEN** 工作流 SHALL 失败并提示修复方式，而不是发布不一致产物

### Requirement: Python SDK is publishable to PyPI as a standard package
Python SDK MUST 具备标准 Python packaging 元数据与依赖声明，并可构建 wheel 与 sdist 以发布到 PyPI（或等价仓库）。

#### Scenario: Build wheel and sdist
- **WHEN** 维护者执行 Python SDK 构建命令
- **THEN** 系统 SHALL 产出可安装的 wheel 与 sdist
- **AND** 产物 SHALL 包含必要的许可证与最小 README 说明

### Requirement: TypeScript SDK is publishable to npm as a standard package
TypeScript SDK MUST 具备标准 npm 包结构（`package.json`、导出定义、类型声明），并可构建/打包发布到 npm（或等价 registry）。

#### Scenario: npm pack produces an installable tarball
- **WHEN** 维护者对 TypeScript SDK 执行 `npm pack`（或等价打包命令）
- **THEN** 系统 SHALL 产出可安装的 `.tgz` 包
- **AND** 产物 SHALL 包含类型声明并可在 TS 项目中消费

### Requirement: CI validates SDK freshness and buildability
CI MUST 校验 SDK 生成结果无漂移，并确保 SDK 可构建（至少执行生成 + diff 校验；发布分支执行构建）。

#### Scenario: Drift is detected in PR
- **WHEN** PR 引入了 OpenAPI 或生成链路变更但未更新 SDK 产物
- **THEN** CI SHALL 检测到 diff 并失败提示如何更新

### Requirement: Release workflow publishes SDKs and archives artifacts
当触发发布（tag）时，系统 MUST 发布 Python SDK 到 PyPI、发布 TypeScript SDK 到 npm，并将构建产物上传为 Release 附件以便追溯。

#### Scenario: Tag release publishes and uploads artifacts
- **WHEN** 推送 `vX.Y.Z` tag
- **THEN** 发布流水线 SHALL 发布两端 SDK
- **AND** 将 wheel/sdist/`npm pack` 产物（以及 schema，如适用）上传到 GitHub Release
