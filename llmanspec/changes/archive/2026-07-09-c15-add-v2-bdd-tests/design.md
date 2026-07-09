## 选型分析

### 需求

1. 原生中文 Gherkin 解析 (`# language: zh-CN`)
2. 与 `bun test` 集成（不需要额外 runner）
3. TypeScript 步骤定义
4. 轻量、无庞大依赖
5. MIT 许可

### 候选方案对比

| 方案                           | 中文        | Bun            | 复杂度 | 许可 |
| ------------------------------ | ----------- | -------------- | ------ | ---- |
| `@cucumber/cucumber`           | ✅          | ⚠️ 自备 runner | 中     | MIT  |
| `playwright-bdd`               | ❌ E2E 专用 | ❌             | —      | MIT  |
| **自研 + `@cucumber/gherkin`** | ✅          | ✅             | 低     | MIT  |

### 推荐方案

**自研轻量 runner** + `@cucumber/gherkin`（仅解析）。

`@cucumber/gherkin` 是 Cucumber 官方的 Gherkin 解析器（41.x，MIT），职责单一：把 `.feature` 文本 → AST。我们只需 ~200 行 glue code 把 AST 节点映射到 `bun test` 的 `describe()` / `test()` block。

```ts
// runner.ts — 核心架构
import { parse } from '@cucumber/gherkin';
import { describe, test, beforeAll } from 'bun:test';

interface StepDef {
  pattern: RegExp | string;
  handler: (ctx: TestContext, ...args: string[]) => Promise<void> | void;
}

class BddRunner {
  defineStep(pattern: string, fn: StepDef['handler']): void;
  runFeature(featurePath: string, stepDefs: StepDef[]): void;
}
```

### 优势

- 与 v1 完全兼容：`.feature` 文件仅改路径 `/v1` → `/v2`
- `bun test` 原生支持：直接 `bun test tests/bdd/` 跑全部
- 零额外 runner 进程
- `@cucumber/gherkin` 仅 120KB，无运行时依赖
- 步骤定义用 TypeScript + async/await，简洁清晰

### 目录结构

```
apps/server/tests/bdd/
├── runner.ts             # Gherkin → bun test 桥接
├── steps/
│   ├── common.ts         # 公共步骤（Given/When/Then）
│   ├── notebooks.ts      # 笔记本管理
│   ├── sessions.ts       # 会话管理
│   ├── messages.ts       # 消息管理
│   ├── sources.ts        # 来源管理
│   ├── tags.ts           # 来源标签
│   ├── qa.ts             # 知识问答
│   ├── outputs.ts        # 结构化输出
│   ├── refine.ts         # 内容精炼
│   ├── analysis.ts       # 笔记本分析
│   ├── research.ts       # 深度研究
│   ├── models.ts         # 模型管理
│   ├── commands.ts       # 命令系统
│   ├── citations.ts      # 引用管理
│   ├── templates.ts      # 模板管理
│   ├── prompts.ts        # 提示词预设
│   ├── studio.ts         # 幻灯片工作室
│   ├── connectors.ts     # 来源连接器
│   └── tasks.ts          # 任务管理
├── features/
│   ├── notebooks/        # 来自 v1 的 .feature 文件
│   ├── sessions/
│   ├── ...               # 共 16 个域 + 1 个 workspace 域
│   └── workspace/
└── fixtures/
    └── server.ts         # 测试服务器启动 fixture
```

### 步骤映射

v1 `pytest-bdd` → v2 `runner.ts` API:

```python
# v1 pytest-bdd
@given(parsers.parse('笔记本"{名称}"已存在'), target_fixture="当前笔记本")
def 笔记本已存在(client, event_loop, 名称): ...
```

→

```ts
// v2 runner API
defineStep('笔记本"{名称}"已存在', async (ctx, 名称) => {
  const res = await ctx.client.post('/v2/notebooks', { name: 名称 });
  ctx.fixtures['当前笔记本'] = await res.json();
});
```

### 实现备注（与上方设计图的偏差）

- **单文件公共步骤**：实际实现把全部 Given/When/Then 放在 `steps/common.ts`
  一个文件里，而非按域拆分。v1 的 120 个共享步骤高度复用，按域拆分反而增加
  跳转成本。run.test.ts 通过 side-effect import 注册，无需 per-domain binding。
- **`bdd.thenStep` 而非 `bdd.then`**：注册器对象的 Gherkin Then 方法故意叫
  `thenStep`。若叫 `then`，oxlint 的 `unicorn/no-thenable` 会把对象当 thenable，
  `unicorn/catch-error-name` 会把每个 `then(cb)` 回调的 `ctx` 参数当 catch
  error（共 19 处误报）。`thenStep` 内部仍 `register('then', ...)`，语义不变。
- **路径模板正则支持 CJK**：`{当前笔记本[id]}` 这类 fixture 引用里 fixture 名
  是中文。`PATH_TEMPLATE_RE` 的字符类必须包含 `\u4E00-\u9FFF`（与 step pattern
  的 param 编译一致），否则 `{当前笔记本[id]}` 不被替换，请求落到错误路径。
- **按 feature 目录 skip**：`run.test.ts` 用 `SKIP_FEATURE_DIRS` 白名单决定
  哪些域跑、哪些域整体跳过（而非 v1 的按场景名 skip）。LLM 域和路由未对齐的域
  在此列；核心 CRUD 域 (notebooks/sessions/messages/tasks/workspace) 实跑。
