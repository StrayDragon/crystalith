---
depends_on: [c04-add-v2-core-crud, c11-add-v2-eval-harness]
batch: all
---
# c13-add-v2-distribution — 分发、性能优化、体验打磨

## Why

v2 的最终目标是单二进制分发 + 桌面 app 体验。Phase 4 涵盖编译打包、Server Mode 可选层、性能优化、错误处理标准化、前端体验打磨。

## What Changes

- **NEW** `bun build --compile` 单二进制 (target: bun-linux-x64/bun-darwin-arm64/bun-windows-x64)
- **NEW** server 静态文件服务 (前端 dist/ 内嵌，与 binary 同目录)
- **NEW** Server Mode 可选层 — JWT 认证、Rate Limiting、Postgres 适配 (通过 drizzle-orm/pg)
- **NEW** CI/CD GitHub Actions 构建矩阵 (6 target)
- **NEW** Tauri v2 桌面包装 (Bun sidecar + Rust shell)
- **MODIFIED** 前端体验优化 (loading/error/empty states, 导出 MD + 引用)

## Capabilities

- publishable-artifacts (spec delta: 分发产物)

## Impact

- 单二进制 ~75MB (含 Bun runtime + AI SDK + unpdf + sqlite-vec)
- Tauri 包装后 ~90MB (.dmg/.exe/.AppImage)
- Server Mode 可选 JWT + Postgres + 限流 (非桌面 app 场景)
