# 测试逐文件隔离（--parallel / --isolate）设计与实现

> 状态：已实现（经本地 + fresh-checkout + CI 双环境验证）。本文为此迁移的
> 设计记录（quick-path，不改任何 MUST/SHALL 行为合约；不触碰
> `llmanspec/specs/**`）。

## 1. 背景与问题

`bun test` 默认把**所有测试文件放在一个进程**里顺序执行：

- `mock.module('ai', ...)` 挂在共享模块注册表上，**无法注销**，会泄漏到后续文件；
- module 级单例（`db()` / `config` / `activeLoops` / `runAbortControllers` /
  `globalThis` 标记）跨文件共享；
- 定时器（`Bun.sleep` / setTimeout）属于事件循环，跨文件残留；
- **文件执行顺序由扫描结果决定**（mtime / 目录遍历），工作区与 fresh checkout
  顺序不一致 → “本地绿、CI 红”。

历史教训（见 git log）：node-agent mock 泄漏、run 状态串文件、`disk I/O error`
（未关闭连接）、`database is locked`（runLoop 尾部写已关库）等，全部是这一
模型下顺序耦合的产物；每次修复治标不治本。

## 2. 方案：`bun test --parallel`（implied `--isolate`）

Bun 提供 `--parallel=<N>`：

- **`--isolate`**：每个测试文件跑在自己的 fresh global + fresh module registry；
- **`--parallel`**：N 个 worker 进程并行分发文件（缺省 = CPU 核数），且 implied
  `--isolate`。

效果：**跨文件泄漏从“纪律/约定防”升级为“机制强制防”**——顺序依赖在此模型下
不再存在；每个文件必须自给自足。

### 为什么是现在

- 现状（单进程 + 定向修复）双环境已绿，但“下一个泄漏点”随时可能咬人；
- 本轮实测：当前 HEAD 在 `--parallel` 下已是 **430 pass / 0 fail**（74 文件全跑，
  无文件消失），此前 37 文件失败的旧数据已被历次硬化修复抹平；
- `--parallel` 加速：4.6s vs 单进程 7.2s（本机）。

### 不可变的选择

| 备选                    | 结论                                  |
| ----------------------- | ------------------------------------- |
| 固定文件顺序跑测试      | ❌ 把脆弱性固化进门禁，新文件一来就破 |
| 反复修单进程泄漏        | ❌ 治标，无终止条件                   |
| `--parallel`（isolate） | ✅ 机制性根治，顺带加速               |

## 3. 实施细节

### 3.1 门禁启用（SSOT via justfile）

`just test` 配方加 `--parallel`（CI 经 `just test` 自动继承）：

```make
test:
    @CL_LOG_LEVEL={{ _qlog }} bun test --parallel {{ _qtest }} --path-ignore-patterns='apps/server/tests/bdd/**' apps/server/tests/ packages/shared/test/
```

- L0（`--only-failures`）与 `--parallel` 兼容：`--only-failures` 仅控制显示；
- L2（`QA_VERBOSE=2`）下 `_qtest` 为空，`--parallel` 仍生效（流式全量照常）。

### 3.2 根因修复：后台 runLoop 泄漏 → teardown 先 drain

**现象**：`--parallel` 下偶发（约 1/4 运行）`SQLiteError: database is locked`
（SQLITE_BUSY，2 个 “Unhandled error between tests”）。

**根因**：`createRun` 等 HTTP 入口会 `scheduleRun()` → `queueMicrotask` 里
`void runLoop(runId)` —— **fire-and-forget 后台协程**。测试只断言 create 响应就
收工；runLoop 继续整条 mock 流水线写库。`--isolate` 下每文件独立 module
registry + 独立临时 DB，teardown 关库后该 loop 的尾部写（`finalizeCancel` /
`finally` 里 `updateRun(llmActivity: null)`）打到已关闭的 DB → SQLITE_BUSY。
单进程下同一泄漏被“写到别的文件的库/进程未退出”掩盖，`--parallel` 把它暴露了。

**修复**（双保险）：

1. `apps/server/src/features/research/run-loop.ts`：r98 等待循环的
   `Bun.sleep(250)` → `sleepUnlessAborted(250, abort.signal)`。取消必须立刻抢占
   等待，而不是等完下一个 poll tick（也方便测试在 teardown 前排干 loop）。
2. `apps/server/tests/helpers/integration.ts`：
   - `teardownIntegrationEnv()` 变 **async**；
   - 关连接前先 `drainResearchLoops()`：对 `activeLoops` 里每个 runId
     `ensureRunAbortController(runId).abort()`（对“已调度未启动”的 loop 也有效：
     首次 `bailIfAborted` 即返回），再轮询 `activeLoops.size === 0`
     （`deadline = 3s`；超时 `console.warn` 兜底）。

   调用点同步：15 个测试文件的内联 `afterAll(() => { teardownIntegrationEnv(); })`
   改为 `afterAll(teardownIntegrationEnv)` 或 `afterAll(async () => { await ... })`，
   保证 bun 等到 drain 完成。

### 3.3 测试自给自足纪律（AGENTS.md）

`--parallel` 把“依赖前一个文件泄漏”变成硬失败，因此测试文件必须：

- 在 import 被测模块**之前**自装 `installAiMock(...)` / `mock.module('ai', ...)`；
- 不自建要依赖别文件状态的全局标记；
- 集成测试一律用 `setupIntegrationEnv` / `teardownIntegrationEnv`（唯一临时 DB +
  自动 drain）。

## 4. 验收标准

1. `just test`（含 `--parallel`）本地连跑 10+ 次：`430 pass / 0 fail`、0
   “Unhandled error between tests”；
2. fresh-checkout worktree（= CI 文件序）同样绿（`--parallel` 下本应与顺序无关，
   双重保险）；
3. 单进程（`bun test` 不带 `--parallel`）仍绿（回归护栏）；
4. `just qa` 全绿；typecheck / lint 0 警告；
5. CI（push 后）全绿。

## 5. 回滚边界

- 撤销 `justfile` 中 `--parallel` 一处即可回到单进程（代码修复无害、可保留）；
- 代码修复本身（abortable sleep + drain）是纯收敛性改进，不回退也不破坏任何
  行为语义。
