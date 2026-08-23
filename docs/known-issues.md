# Known Issues & Toolchain Notes

> 已知问题与工具链兼容性台账。解决后条目应移入「已解决」段保留一段时间，防止重复踩坑。

## 运行时怪癖（上游）

### `app.handle()` 对单字符 Host 返回 404

- **现象**：`createApp().handle(new Request('http://x/v2/notebooks/abc'))` 稳定返回泛化
  `404 NOT_FOUND`，同一路径换正常长度 host（如 `test.local`）即正常匹配。
- **根因**：上游 Elysia/Bun 路由分发问题，与业务代码无关。旧代码（手工 params 解析）同样复现。
- **影响**：仅影响用怪异 host 写的临时探针脚本；真实流量（浏览器/curl/测试基址）不受影响。
- **缓解**：探针脚本使用 `http://test.local` 作为基址（与集成测试一致）。

### Bun 后台进程随父 shell 超时被杀

- **现象**：`nohup ... &` 启动的 dev server 在 agent 会话命令超时后被 SIGTERM（exit 143）。
- **缓解**：用 `setsid nohup … < /dev/null &` 完全脱离进程组。

## 工具链兼容性（TypeScript 7 / tsgo）

背景：TypeScript 7 是 Go 原生编译器，npm 包**不再附带经典 JS 编译器 API**
（`ts.createProgram` 等）。任何在构建期 `import 'typescript'` 并调用这些 API 的代码生成器都会损坏。

| 工具                                   | 状态              | 说明                                                                                                                 |
| -------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| ~~typesafe-i18n CLI~~                  | ✅ 已移除         | 5.27.1 生成器调用 `ts.createProgram` → TypeError；且上游停维。i18n 改为 zh/index.json SSOT + 手写 shim + drift check |
| drizzle-kit                            | ✅ 正常           | 未声明 typescript 依赖、bundle 内零 `createProgram` 引用                                                             |
| oxlint / oxfmt                         | ✅ Rust 实现      | 无关                                                                                                                 |
| vitest / vite                          | ✅ 自带 transform | 不走 TS JS API                                                                                                       |
| elysia / msw / ts-essentials / valibot | ✅ 审计通过       | 声明了 ts peerDep 但 dist 内零 `createProgram` 使用（2026-08-23 全量扫描）                                           |

**新增依赖守则**：凡是「读取 .ts 源码做生成/转换」的工具，引入前先确认其不依赖 TS 经典编译器
JS API；TS 大版本升级后优先冒烟所有 codegen 类 script（`just gen-all`、db:generate）。
