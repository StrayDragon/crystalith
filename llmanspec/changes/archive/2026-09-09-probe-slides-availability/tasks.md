# Tasks — probe-slides-availability

> Seam：`bun test apps/server/tests/`（createApp 进程内请求；用 Bun.serve 在
> 临时端口起假 Slidev（`/slidev/` 返回 200）+ 配置 `CL_SLIDEV_BASE_URL` 驱动
> 探测两分支）；前端 Vitest 组件测试沿用 StudioToolsGrid 既有渲染测试基建。

## T1 配置面

- [x] `apps/server/src/shared/config.ts`：`SlidesPreviewSchema`（`base_url`
      默认 `http://127.0.0.1:3030`、`probe_timeout_ms` 默认 1500）+
      `getSlidesPreview()` typed accessor；挂进 RootConfig
- [x] `config/app.yaml`：新增 `slides_preview` 节（含 `{{ env.CL_SLIDEV_BASE_URL }}`
      模板与注释）；`packages/shared/src/schemas/env.ts` 声明 `CL_SLIDEV_BASE_URL`
- [x] 再生 `config/app.schema.gen.json` + `.env.example`（`just gen-env-examples`
      等价生成路径），`check-app-schema` / `check-env-examples` 门禁过

## T2 探测模块 + tools 契约

- [x] `apps/server/src/shared/slides-availability.ts`：`probeSlidesAvailability()`
      —— TTL 10s 缓存 + 进行中去重；`available/errorCode/message/hint`；
      插件层（`pluginRegistry.implOf('slides-slidev')`）∨ 进程层（GET
      `<base_url>/slidev/`）两分支 errorCode
- [x] `features/workspace/router.ts`：`diagnostics.slides` 填充探测结果；
      SLIDES tool `enabled` 改为 `available`（engine/activePluginId 填实值）
- [x] server 测试：假 Slidev 可达 → `slides.available=true` + SLIDES enabled；
      不可达 → `available=false` + `SLIDES_PREVIEW_UNREACHABLE` + hint 非空；
      插件缺失分支（registry 空 impl）→ `SLIDES_PLUGIN_MISSING`

## T3 前端移除 + 诊断呈现

- [x] `StudioToolsGrid.tsx`：`diagnostics.slides.available === false` 时过滤
      SLIDES 卡片（诊断数据经父级 toolsDiagnostics 传入）
- [x] DiagnosticsDialog `diagnostics.slides` 渲染复核（已存在，补 unavailable
      分支文案与 hint 展示断言即可）
- [x] 前端测试：可用 → SLIDES 卡片在；不可用 → 卡片不在 + 其余工具不受影响

## T4 文档与验收

- [x] README「已知限制」段更新（单二进制形态 SLIDES 自动隐藏，不再是「暂不可用」）
- [x] `docs/plugins.md` 暴露面表格补一行探测宿主职责备注（防腐烂指针 → design D1）
- [x] 门禁：typecheck / lint / format / server+shared tests / web Vitest / e2e @p0
