---
depends_on: []
blocks: []
branch: sdd/ship-server-binary
base_sha: f903d1abff5d775c295c67d5ed1217bbbb191bba
checkpointed: true
checkpoint_sha: aa8c6063820b309e1cb58e0ef70afbe0daa82055
---

# Proposal — ship-server-binary（c13 v1：web 模式单二进制分发）

> 状态：proposal/design 就绪（Designed）。Branch binding 待实施启动时执行；
> 实施排序在 A 线（开源发布）收尾之后。Tauri 桌面端**不在本 change 范围**（delay，另行立项）。

## Why

c13（distribution）长期阻塞于分发形态决策。2026-09-08 已拍板：

1. **首版只做 web 模式的 server 单二进制**。headless 优先：裸 CLI/TUI 用户与
   第三方 client 直接对接 server HTTP API 是一等场景（server 必要内核）。
2. 插件分发走 npm（见 `plugin-interface-ssot`，本 change 不含插件机制本身）。

当前交付方式只有「clone + bun dev / bun run」，自托管与分发的最小路径缺失；
`bun build --compile` 单二进制是既有架构决策（AGENTS.md Single Binary），
本 change 把它落成可发布产物。

## What Changes

- 新增 server 单二进制构建管线：`bun build --compile` 打包 `apps/server`
  （内含 sqlite-vec / unpdf / cheerio 等既有 bundled deps），产出
  `crystalith-server`（macOS arm64/x64、linux x64/arm64、windows x64）
- web 静态资源随二进制分发：server 以 web 模式托管 API + 前端静态资源，
  单进程交付完整产品（静态资源注入方式见 design）
- 发布工程：版本号来源（`2.0.0-dev` → tag 驱动）、release 工件清单、
  校验和；docker 镜像构建保持与二进制同源
- headless 一等场景显式化：无浏览器依赖即可完整使用 HTTP API
  （Eden treaty / OpenAPI 衍生 client 均可用）；文档补 CLI/TUI 对接指引
- config/env 面不变：`CL_*` SSOT、`config/app.yaml`、`CL_SERVER_HOST/PORT`
  语义不动（127.0.0.1 默认绑定与 auth 开关原样保留）

## Capabilities

- `configuration-governance`：新增「二进制分发形态下配置解析路径不变」约束（如有必要）
- `public-repo-hygiene`：release 工件与下载/运行文档的最小一致性

## Impact

- 不改任何 wire 行为 / 业务语义；纯构建、打包与发布工程
- CI（开源后接入）需要 matrix 构建能力；`engines.bun` 已钉
- Tauri sidecar 桌面分发为本 change 的后继（`blocks` 待新 change 立项后回填）
