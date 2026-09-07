# Tasks — add-extractor-arxiv

> Seam：`bun test apps/server/tests/plugins/`（registry DI 注入 stub fetch）+
> 插件包自带解析单测；无 wire 改动。

## T1 插件包

- [x] `packages/plugin-extractor-arxiv`：package.json（scope 名）+ `src/index.ts`
      （CrystalithPlugin default export；Atom 解析；host 门控；ctx.fetch 出站）
- [x] 免启服调试运行器 `scripts/try.ts`
- [x] `bun install` 建立 workspace symlink（discovery 可命中）

## T2 宿主 ctx.fetch 注入

- [x] `CrystalithPluginContext` 增加必填 `fetch`（outboundFetch），registry
      factory 调用点注入；既有内置插件不使用 fetch，行为不变

## T3 测试

- [x] Atom 解析单测（fixture：正常 entry / 多作者 / 空结果）
- [x] host 门控单测（非 arxiv URL → 空内容降级）
- [x] registry 集成：live ensureLoaded 后 `extractor-arxiv` 被发现并加载
      （依赖 workspace symlink）；既有 wire 断言更新（extractor 名单追加 arxiv）

## T4 文档

- [x] `docs/plugins.md`：本地快速调试教程（try.ts 运行器 + workspace symlink +
      重启语义）与代理配置说明（CL_PROXY_* / proxy_settings / HTTPS_PROXY）
