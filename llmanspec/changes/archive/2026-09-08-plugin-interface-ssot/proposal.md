---
depends_on: []
branch: sdd/plugin-interface-ssot
base_sha: 0bdb013b41325c461c2028e8afcf7ac88dff68a8
checkpointed: true
checkpoint_sha: 0bdb013b41325c461c2028e8afcf7ac88dff68a8
---

# Proposal — Plugin Interface SSOT

> 状态：正式化（2026-09-08）。c13 分发决策已拍板（web 单二进制首版 + npm 插件，
> Tauri delay），本 change 解除 parked； Branch binding 后实施。

## Why

v2 无插件宿主：studio slides config 表以「内置表」形式存在
（apps/server/src/features/studio/config.ts 头注释已注明 c13 relocate 意图），
extractor 以内置注册表存在（shared/extraction/factory.ts）。
c13 已确认支持外部插件且分发载体为 **npm**，需要先有一个 Plugin 接口 SSOT，
避免各域自造插件形状、外部插件作者面对多套契约。

## What Changes

- 定义 `CrystalithPlugin` 接口 SSOT：id / kind（output-type | extractor | parser |
  slides-workflow）/ configSchema（Zod）/ factory 入口 / 能力声明
- studio config 表与 extractor factory 迁移为该接口的两个内置实现（行为不变，
  wire 不变）
- `/v2/workspace/tools` 的 diagnostics.official catalog 由接口清单驱动
  （workspace-api-contract r18 已预留该形态）
- **分发载体（已拍板）：npm 包，`@crystalith-plugin/*` scope**。加载语义为
  **「npm 依赖 + 重启加载」**：插件作为 server 的 npm 依赖安装，启动时按
  `plugins.enabled` allowlist / `disabled` denylist 动态 import（node_modules 解析），
  不搞运行时热插拔——安装/升级 = 改依赖 + 重启 server
- `config/app.yaml` 的 `plugins:` 段语义保持（enabled/disabled/load_order），
  清理其 v1 Python entry points 残留注释

## 非目标

- 不引入运行时热插拔（无 uninstall-without-restart、无 sandbox 内动态注册）
- 不改变任何现有 wire 行为
- 插件市场/registry 服务端不在范围内（npm registry 即分发面）
- Tauri/桌面分发见 `ship-server-binary` 及其后继，与本 change 解耦

## 约束（供应链与跨平台）

- 外部插件 MUST 为纯 JS（Zod configSchema + factory），MUST NOT 依赖 native addon
- 官方插件 scope 约定 `@crystalith-plugin/*`；非该 scope 的包默认不出现在
  official catalog，仅可作为普通 npm 依赖被 allowlist 显式启用
