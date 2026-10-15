# Known Issues & Toolchain Notes

> 已知问题与工具链兼容性台账。解决后条目应移入「已解决」段保留一段时间，防止重复踩坑。

## 产品已知问题

### 聊天区用户消息短暂丢失 + 完成时闪烁（局部刷新）（2026-10-15 端侧发现，已定位修复，待端侧复验）

- **现象**：聊天区用户发送的文本有时会丢失，等 AI 回复有数据时才一并显示；且回复完成时
  会闪一下（疑似局部整段重渲染）。不符合预期。
- **预期形态**：用户发送后立即上行并**本地立即可见**（乐观渲染，不依赖回复数据到达）；
  等待 API 回复期间进入打字机流式呈现；流式/完成路径**不得触发可见的闪烁或局部刷新**。
- **根因**（2026-10-15 代码定位，两处竞态，均与业务无关）：
  1. **完成闪烁**：`useChat` 流式 `done` 后 `void mutate()`（消息列表 refetch）尚未返回，
     `finally` 就翻转 `isStreaming`/`loading.send` → 消息镜像 effect 以非保留模式用**发送前的
     过期 SWR 数据**整体替换 store，本轮对话（用户气泡+回复）消失一个网络往返再回来。
     非流式路径的 `void mutate()` 同理。
  2. **用户气泡间歇丢失**：首发新会话时 `ensureSession` POST 期间 sessions SWR 数据落地，
     effect 在 `activeSessionId == null` 时自动挂到「列表最新旧会话」，真会话创建完成后
     `setActiveSession` 判定 switching → 清空 messages，乐观气泡被抹掉，直到 `done` 后
     refetch 才随回复一起回来（即「等 AI 回复有数据时才一并显示」）。
- **修复**（quick 路径，回归测试 `useChat.test.tsx` / `useSessions.test.tsx`，已验证旧代码变红）：
  ① refetch await 后再清 flag（流式+非流式）；② 发送在途时 sessions effect 不自动挂载/清空
  会话；③ `sendMessage` 先定会话再写乐观气泡（会话创建失败不再留悬挂气泡）。
- **恢复/删除条件**：端侧各验证一次「发送即显 + 完成无闪烁」后删除本条目。

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

### just qa 的 fallow 门禁在未推送范围基线即红（2026-10-15 发现，存量债，未解决）

- **现象**：`fallow audit`（scope = merge-base(origin/main) → 工作树，38 个未推送提交）
  在**不含任何未提交改动的 HEAD 基线**即失败：`✗ 11 unused type exports`
  （`apps/server/src/shared/config-settings.ts` 9 + `useSources.ts` re-export 1 + `testids.ts` 1）
  与 `✗ High complexity functions`（80+，WorkspaceLayout / useOutputQueue / useChat 等大函数），
  `just qa` 在 `audit-fallow` 步骤被挡（本地需 `node_modules/.bin` 入 PATH）。
- **边界**：2026-10-15 聊天时序修复的 4 个文件经 `fallow audit --format json` 过滤贡献
  **0 条**发现；useSessions 已通过抽取 `applySessionsSnapshot` 降回阈值内。
- **恢复/删除条件**：unused types 需逐个判断「删除导出 vs 补消费方」（config 类型勿盲删），
  complexity 清单按 cl-codebase-cleanup 方法分批消化；处理完或推送后 merge-base 前移使
  门禁复绿，即删本条目。

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

## 依赖升级遗留（c127 裁剪项）

| 项                               | 状态                                                                                                                                                                                                                                                        | 恢复/删除条件                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| tailwindcss 3→4                  | **裁延**：v4 需 css-first theme 重写（`@tailwind`→`@import "tailwindcss"`+`@theme`）、`@source` 替代 content、`tailwind-scrollbar@4`（peer 强制 tw4）连动、Layer 系统 `z-[N]` arbitrary 与 43 处 `!important` 交互回归——预估 >1 天，按 c127 design 阈值裁出 | 单独 change 承接；完成后删除本条并升 `tailwind-scrollbar` 4                     |
| oxlint-tsgolint 7 advisory 3 err | 前存 Tier1 债（`just type-aware-lint` 本就允许失败），升级后数量不变                                                                                                                                                                                        | 按 AGENTS「type-aware 债清」专项消化；清零后删条目                              |
| `@ai-sdk/*` 精确 pin→range 收尾  | 六件套已升 4.0.78 系并改 range 锁步；`provider` 单一 hoist 已验证                                                                                                                                                                                           | 无需动作；仅当再遇 dual-provider hoist 时参考 c127 design「cast wall 收敛」预案 |
