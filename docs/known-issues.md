# Known Issues & Toolchain Notes

> 已知问题与工具链兼容性台账。解决后条目应移入「已解决」段保留一段时间，防止重复踩坑。

## 运行时怪癖（上游）

### Elysia `handle()` 对 ≤3 字符 Host 返回 404（上游，未解决）

- **现象**：`app.handle(new Request('http://x/…'))` 对**所有路由**稳定返回泛化
  `404 NOT_FOUND`。边界实测：host `x`/`ab`/`abc` 均挂，`abcd` 起正常；覆盖
  Host 头无效（按 URL 字符串解析）；Bun 的 `new URL` 解析正常，问题在 Elysia。
- **根因**（2026-09 定位，Elysia 1.4.29 / 1.4.30 均复现）：`dist/utils.mjs` 的
  `replaceUrlPath` 与 `dist/dynamic-handle.mjs` 的路径提取写死
  `url.indexOf("/", 11)`——偏移 11 = `"http://"`(7) + 4，**假设 host ≥4 字符**。
  host ≤3 时路径起始斜杠位于 11 之前，`indexOf` 返回 -1，path 退化成完整 URL
  （`onRequest` 里 `ctx.path === "http://x/health"`），路由自然全部匹配失败。
  与业务代码无关。
- **影响**：仅影响用怪异 host 写的临时探针脚本；真实流量（浏览器/curl/测试基址）不受影响。
- **缓解**：探针脚本使用 `http://test.local` 作为基址（与集成测试一致）。
  上游修复只需把魔数 11 换成按实际 scheme 计算（如
  `url.indexOf("/", url.indexOf("//") + 2)`）；影响面不值得做依赖补丁，
  待上游修复后删除本条目。

### Bun 后台进程随父 shell 超时被杀

- **现象**：`nohup ... &` 启动的 dev server 在 agent 会话命令超时后被 SIGTERM（exit 143）。
- **缓解**：用 `setsid nohup … < /dev/null &` 完全脱离进程组。

## 单二进制构建（`bun build --compile` / Bun.build compile）

### 运行时 require 的 JSON / 平台包不会被内嵌（已缓解）

- **现象**：CLI `bun build --compile` 产物启动即报
  `Cannot find module '../data/patch.json'` / `Cannot find module 'mdn-data/css/at-rules.json'`；
  绕过启动后笔记本接口 500，报 `Cannot find package 'sqlite-vec-linux-x64'`。
- **根因**：jsdom → `@asamuzakjp/dom-selector` → css-tree 的 `lib/data-patch.js`
  与 `lib/data.js`（`createRequire(import.meta.url)`）在模块顶层**运行时** require
  JSON，Bun 的编译产物不内嵌这类运行期解析；sqlite-vec 的 `load()` 同理，用
  `import.meta.resolve` 定位平台包里的 `.so`，在 `$bunfs` 虚拟文件系统内不可见。
- **缓解**：构建统一走 `apps/server/scripts/build-binary.ts`（Bun.build API：
  插件把 css-tree 内字面量 JSON require 内联为字面量；注入 `CL_BUILD_VERSION`）；
  sqlite-vec 回退加载二进制旁 `native/vec0.*`（`CL_SQLITE_VEC_PATH` 可覆盖；
  `just release` 打包时附带）。Drizzle 迁移目录同理按「源码树 → 二进制旁 → CWD」
  顺序解析，release 布局附带 `drizzle/`。
- **守则**：新依赖若在模块顶层 `createRequire` / `require` JSON 或原生文件，
  编译产物会挂——接入后必须 `just build-binary` + 启动冒烟（`/health` + 一次建
  笔记本）验证。

## 单二进制分发（`bun build --compile` / Bun.build compile）

### macOS 产物暂缓：系统 SQLite 不支持扩展加载（上游限制，未解决）

- **现象**：编译产物在 macOS 上 `db.loadExtension(native/vec0.dylib)` 报
  "This build of sqlite3 does not support dynamic extension loading"，RAG 向量
  检索完全不可用（/health 正常，写库即 500）。Linux 产物不受影响（Bun 自带
  SQLite，扩展可用——linux-x64/arm64 冒烟通过）。
- **根因**：Bun 的 SQLite 按平台分链——Linux/Windows 静态链接自带 SQLite
  （扩展可用），macOS 链接 Apple 系统 SQLite（Apple 构建不带扩展支持），
  上游讨论见 [oven-sh/bun#5756](https://github.com/oven-sh/bun/issues/5756)。
  与代码签名无关（ad-hoc codesign 已验证无效）。
- **官方出路（2026-09 核对 Bun 文档）**：macOS 可先 `Database.setCustomSQLite()`
  指向用户自装的原生 sqlite dylib（如 Homebrew，安装路径含版本号）再
  loadExtension。但这要求终端用户预装 sqlite 且路径脆弱，破坏单二进制
  「自包含」交付 → darwin leg 维持暂缓；win32 与 Linux 同为静态链接自带
  SQLite，有望直接解锁，待 Windows 冒烟确认。
- **处置**：Release 矩阵 darwin 暂缓（D3 冒烟 = 产物质量门禁，不发布 RAG 残缺
  产物）；其余恢复条件 = 实现纯 TS 向量检索降级（vec0 不可用时的暴力扫描
  路径，需先落数据模型）。
- **注意**：`native/vec0.*` 随包 + `CL_SQLITE_VEC_PATH` 回退机制保留（Linux 上
  必需；darwin codesign 步骤同样保留，上游放开后即需）。

## 工具链兼容性（TypeScript 7 / tsgo）

背景：TypeScript 7 是 Go 原生编译器，npm 包**不再附带经典 JS 编译器 API**
（`ts.createProgram` 等）。任何在构建期 `import 'typescript'` 并调用这些 API 的代码生成器都会损坏。

| 工具                           | 状态              | 说明                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~typesafe-i18n CLI~~          | ✅ 已移除         | 5.27.1 生成器调用 `ts.createProgram` → TypeError；且上游停维。i18n 改为 zh/index.json SSOT + 手写 shim + drift check                                                                                                                                                                                                        |
| drizzle-kit                    | ✅ 正常           | 无 typescript 依赖、bundle 内零 `createProgram` 引用（2026-09-18 复扫 + 实跑）。`db:generate` 非 TTY 下卡交互式 rename 确认，与本项无关；快照健康用 `bunx drizzle-kit check`                                                                                                                                                |
| oxlint / oxfmt                 | ✅ Rust 实现      | 无关                                                                                                                                                                                                                                                                                                                        |
| rstest                         | ✅ 自带 transform | Rspack/SWC transform，不走 TS JS API（vitest 已随 web 迁移移除）                                                                                                                                                                                                                                                            |
| elysia / msw                   | ✅ 无 TS 耦合     | 2026-09-18 重扫 dependencies/peerDependencies 均无 typescript（2026-08-23 首审时曾为 peerDep，现已移除）                                                                                                                                                                                                                    |
| slidev（`@slidev/*`+twoslash） | ⚠️ 自持嵌套 TS 6  | `@slidev/cli` 真依赖 `typescript@^6.0.3`；twoslash / `@shikijs/twoslash` / `@typescript/{ata,vfs}` peer 仅 `^5.5 \|\| ^6` → bun 落嵌套 typescript@6.0.3（树内唯一真跑经典编译器 API 的消费者，与根 TS 7 隔离）。slides 片段 twoslash 检查按 TS 6 语义、与仓库 TS 7 有版本偏斜；可用性不受影响，待上游 peer 升 ^7 后自然收敛 |

**新增依赖守则**：凡是「读取 .ts 源码做生成/转换」的工具，引入前先确认其不依赖 TS 经典编译器
JS API；TS 大版本升级后优先冒烟所有 codegen 类 script（`just gen-all`、db:generate）。
2026-09-18 冒烟：根 TS 7.0.2，`just gen-all` 零漂移；`db:generate` 见上表 drizzle-kit 行。
