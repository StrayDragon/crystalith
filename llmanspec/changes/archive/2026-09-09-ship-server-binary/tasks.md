# Tasks — ship-server-binary

> Seam：`bun test apps/server/tests/shared/web-static.test.ts`（createApp 进程内
> 请求 + tmp web/dist 夹具）；产物级验收 = `just release` 解压后启动冒烟
> （/health、GET /、SPA deep-link、POST /v2/notebooks、未知 API 404 envelope）。

## T1 静态 web 托管（design D1-B）

- [x] `apps/server/src/shared/web-static.ts`：`resolveWebDistRoot()`（CL_WEB_DIST
      → 可执行文件旁 `web/dist`）；`webStaticRoutes(root)` 尾部 `GET /*` catch-all
      ——根路径恒回 index.html、扩展名路径 404、无扩展名 HTML 导航 SPA fallback、
      API 前缀与 root=null 一律 NotFoundError（JSON envelope 语义保持）
- [x] `apps/server/src/server.ts`：链尾挂载 catch-all；`/health` 与 OpenAPI
      version 接 `SERVER_VERSION`（`shared/version.ts`，`CL_BUILD_VERSION` 注入）
- [x] `tests/shared/web-static.test.ts`：9 用例（根/资产/SPA/未知 API/缺失资产/
      穿越/root=null）+ `tests/openapi-generation.test.ts` 允许清单加 `GET /*`

## T2 二进制构建修复（design D3 风险实锤）

- [x] `apps/server/scripts/build-binary.ts`：Bun.build API + compile；插件内联
      css-tree lib/cjs 内字面量 JSON require（`data/patch.json`、`mdn-data/*`，
      jsdom 链运行时 require 不会被 compile 内嵌）；`CL_BUILD_VERSION` define
- [x] `apps/server/src/db/index.ts`：迁移目录「源码树 → 可执行文件旁 → CWD」解析
      （候选须含 `meta/_journal.json`）；sqlite-vec `load()` 失败回退
      `native/vec0.*`（`CL_SQLITE_VEC_PATH` 可覆盖）
- [x] `apps/server/package.json`：`build` 指向新脚本；`.gitignore` 忽略编译产物

## T3 发布打包（design D2）

- [x] `scripts/build-release.ts`：web build → 二进制 → stage（二进制 + web/dist +
      drizzle + native/vec0 + config/{app.yaml,app.schema.gen.json}，显式排除
      secret.env）→ tar.gz + sha256；版本 = HEAD tag（去 v 前缀）否则 package.json
- [x] `justfile`：`build-binary` / `release` 两个 recipe（替换旧 TODO 注释块）

## T4 文档与验收

- [x] README 重写（lspz 风格）：特性 / quickstart / 部署布局 / 已知限制（Slidev
      预览）与工件布局一致（r464）
- [x] `docs/known-issues.md`：Bun compile 运行时 JSON require / sqlite-vec 台账 + 「新依赖须跑 build-binary 冒烟」守则
- [x] 产物级冒烟：解压 tar.gz → 全新目录启动 → /health（版本注入）、GET /、
      SPA deep-link、POST /v2/notebooks（迁移 + vec0 加载）、未知 API 404 全过
- [x] 门禁：typecheck / lint / format / server+shared+web tests / e2e @p0 全绿
