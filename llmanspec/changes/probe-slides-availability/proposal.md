---
depends_on: []
branch: sdd/probe-slides-availability
base_sha: f903d1abff5d775c295c67d5ed1217bbbb191bba
checkpointed: false
---

# Proposal — probe-slides-availability（SLIDES 可用性自动发现 + 前端自动移除）

## Why

SLIDES 的预览依赖独立的 Slidev 进程（dev 由 overmind `slidev` job 提供，:3030），
server 对它零感知。当前 `/v2/workspace/tools` 对 SLIDES tool 硬编码
`enabled: true`、`diagnostics.slides` 恒为 `null`（预留插槽从未填充），前端
生成入口在 Slidev 不存在时（单二进制 / 自托管最小部署 / slidev 进程挂掉）
仍然展示，点进去才降级报「演示能力当前不可用」——既违反 r272（UI MUST 以
tools 契约为可用性唯一来源）的精神，也是 ship-server-binary 落地后单二进制
形态下的已知缺陷（README 已标注）。

## What Changes

- server 新增 slides 预览可用性探测：新 config 节 `slides_preview`
  （`base_url` 默认 `http://127.0.0.1:3030`、`probe_timeout_ms` 默认 1500，
  env 覆盖 `CL_SLIDEV_BASE_URL`），对 `<base_url>/slidev/` 做 GET 探测，
  结果短 TTL 缓存（10s），失败降级为数据而非异常（对齐 health.ts 既有模式）
- `/v2/workspace/tools` 填充预留的 `diagnostics.slides`
  （`available/message/hint/activePluginId/engine/errorCode`）：
  `available = 插件已加载 ∧ 探测可达`；不可用时给出稳定 errorCode
  （`SLIDES_PREVIEW_UNREACHABLE` / `SLIDES_PLUGIN_MISSING`）与可执行 hint；
  SLIDES tool 的 `enabled` 字段改为反映该可用性（其余 tool 不变，恒 true）
- 前端 StudioToolsGrid 在 `diagnostics.slides.available === false` 时**移除**
  SLIDES 卡片（不渲染入口）；不可用原因与恢复提示由 DiagnosticsDialog 已有的
  `diagnostics.slides` 渲染承担（r62：server 不从 tools 列表隐藏、原因可呈现）
- wire schema 零新增字段（`WorkspaceToolsSlidesDiagnosticSchema` 与
  `tool.enabled` 均已存在）；仅 `packages/shared/src/schemas/env.ts` 增加
  `CL_SLIDEV_BASE_URL` 声明并再生 `.env.example` / `app.schema.gen.json`

## Capabilities

- `studio-slides-workflow`：新增可用性判定与 UI 移除规则（scope 相应扩展）

## 非目标 / 设计取舍（详见 design.md）

- **不做 `slides-workflow` 插件化探测**：内置 `slides-slidev` 目前仅 configSchema
  走 registry（生成链路未接，docs/plugins.md 路线第 3 条），探测是宿主诊断职责；
  长线生成链路接 registry 后可挪进 impl 的 `isAvailable()`（extractor 先例）
- **不镜像到 `/health/dependencies`**：避免同一信号双 SSOT；DiagnosticsDialog
  已渲染 `diagnostics.slides`，运维可见性已覆盖
- 前端不移除 SlidesStudioDialog 内既有的降级文案链（纵深防御，直开 URL 场景仍在）

## Impact

- 行为变更：Slidev 不可达时前端生成弹层不再显示 SLIDES 入口（此前显示但点入失败）
- 兼容性：`diagnostics.slides` 从恒 null 变为可填充——schema 早已声明为可空对象，
  消费端（DiagnosticsDialog / resolveSlidesRecoveryHint）均已按可空处理，无破坏
- 运维：自托管最小部署不再需要解释「点了没反应」；dev（overmind）零配置自动可用
