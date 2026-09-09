# Design — probe-slides-availability

## 决策点与取舍

### D1 探测的宿主归属：为什么不是「插件」

用户问题：「能不能作为插件实现，或有没有更符合直觉、好维护的方式？」

结论：**探测属于宿主诊断职责，现阶段不插件化**。理由：

1. 内置 `slides-slidev` 虽已按 `slides-workflow` kind 注册进 pluginRegistry，
   但 registry 目前只被消费 `buildSlidesConfigSchema()`（configSchema 一项）；
   生成/预览链路完全没接 registry（`docs/plugins.md` 暴露面表格明确该 kind
   为「⏳ 半接线，暂不对外」）。把探测挂在一个只有半个消费者的插件 impl 上，
   可用性信号会出现「impl 缺席时无人负责探测」的空洞——探测必须独立于 impl
   存在才能解释 impl 为什么缺席（与 `diagnostics.plugins.skipped` 同构）。
2. 更符合直觉的形态是**宿主探测 → 填充契约预留槽**：`diagnostics.slides`
   字段、前端 DiagnosticsDialog 渲染、`resolveSlidesRecoveryHint()` 恢复链路
   全部早已就位，server 却恒回 `null`。本次只是把既有契约履行完毕。
3. 长线路径（非目标，记录防腐烂）：docs/plugins.md 路线第 3 条「生成链路接
   registry」落地后，探测应下沉为 `slides-workflow` impl 的 `isAvailable()`
   （extractor 的 `isAvailable(config)` 是既有先例），宿主退化为汇总者
   （多 slides 插件候选 → 结构化诊断）。届时本 change 的探测模块即是其雏形。

### D2 可用性语义：两层条件

`available = 插件已加载（implOf('slides-slidev') 非 null）∧ 预览进程可达（探测）`

- 插件层失败 → errorCode `SLIDES_PLUGIN_MISSING`（对齐 plugins.skipped 语义，
  hint 指向 plugins 配置）
- 进程层失败 → errorCode `SLIDES_PREVIEW_UNREACHABLE`（hint 指向
  overmind/`slides_preview.base_url` 配置）
- 探测目标：`GET <base_url>/slidev/`（Slidev CLI `--base /slidev/` 布局，
  `packages/crystalith-slidev/scripts/dev.mjs`），`res.ok` 即可达

### D3 探测缓存与频率

`/v2/workspace/tools` 被前端 SWR 轮询，探测 MUST 带 TTL 缓存（10s）+
进行中去重（同一时刻只发一个探测请求），超时默认 1500ms（r224：经 config
schema 定义）。缓存使 SLIDES 移除的生效延迟 ≤10s，可接受。

### D4 配置面（configuration-governance 对齐）

```yaml
slides_preview:
  base_url: 'http://127.0.0.1:3030' # 空 = 显式禁用（视为不可达，不再探测）
  probe_timeout_ms: 1500
```

- env 覆盖：`CL_SLIDEV_BASE_URL`（r85：CL_ 前缀 + env.ts 声明 + .env.example 再生）
- 节名 snake_case、与 schema 名对齐（r249）；accessor `getSlidesPreview()`
  typed accessor（r158）；探测运行时进行，不污染配置加载纯度（r8）

### D5 前端：移除而非禁用

用户明确要求「不可用时自动移除生成选项」。落点 `StudioToolsGrid`：SLIDES
卡片渲染前过滤（`diagnostics.slides?.available === false`）。与 r62 不冲突：
server 端 SLIDES 仍在 tools 列表中（MUST 不从 API 列表隐藏），不可用原因经
`diagnostics.slides` 在 DiagnosticsDialog 可呈现；UI 层的移除正是 r272
「UI 以 tools 契约为唯一可用性来源」的履行。

## 非目标

- `/health/dependencies` 镜像（避免双 SSOT；运维可见性由 DiagnosticsDialog 承担）
- slides 生成链路接 pluginRegistry（docs/plugins.md 路线第 3 条，另行立项）
- Slidev 进程的 spawn/生命周期管理（维持「进程独立、探测即数据」边界）
