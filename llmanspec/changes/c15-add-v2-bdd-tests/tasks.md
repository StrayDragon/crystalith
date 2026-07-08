# add-v2-bdd-tests — Tasks

## 1. Runner 实现

- [ ] `apps/server/tests/bdd/runner.ts` — Gherkin AST → bun test bridge (~200 行)
- [ ] `apps/server/tests/bdd/fixtures/server.ts` — 测试服务器启动/销毁 fixture
- [ ] 新增依赖: `@cucumber/gherkin` (解析器, MIT)
- [ ] 验证: `bun test tests/bdd/` 可运行（即使 0 test，runner 应能加载 feature 文件）

## 2. 公共步骤

- [ ] `apps/server/tests/bdd/steps/common.ts` — Given/When/Then 公共步骤实现
  - 已启动应用、笔记本 CRUD fixture、会话 CRUD fixture
  - HTTP 请求包装 (GET/POST/PATCH/DELETE)
  - 响应上下文管理
  - 断言步骤：响应状态码、字段值、列表长度、包含子串等
- [ ] 验证: 一个 notebook CRUD feature 全部通过

## 3. Feature 文件移植 (17 个)

- [ ] 从 `backend/py/tests/bdd/features/` 复制到 `apps/server/tests/bdd/features/`
- [ ] 所有路径前缀 `/v1/` → `/v2/`（批量 sed）
- [ ] 按域确认: notebooks, sessions, messages, sources + tags, qa, outputs, refine, analysis, research, models, commands, citations, templates, prompts, studio, connectors, tasks, workspace

## 4. 领域步骤实现

- [ ] `notebooks.ts` — 笔记本 CRUD BDD 步骤
- [ ] `sessions.ts` — 会话管理步骤
- [ ] `messages.ts` — 消息管理步骤
- [ ] `sources.ts` — 来源上传/管理/tags/搜索步骤
- [ ] `qa.ts` — QA 问答步骤 (streaming + non-streaming)
- [ ] `outputs.ts` — 结构化输出步骤
- [ ] `refine.ts` — 内容精炼步骤
- [ ] `analysis.ts` — 笔记本分析步骤
- [ ] `research.ts` — 深度研究步骤
- [ ] `models.ts` — 模型管理步骤
- [ ] `commands.ts` — 命令系统步骤
- [ ] `citations.ts` — 引用管理步骤
- [ ] `studio.ts` — 幻灯片工作室步骤
- [ ] `connectors.ts` — 来源连接器步骤
- [ ] `tasks.ts` — 任务管理步骤
- [ ] `workspace.ts` — 工作空间步骤

## 5. 集成验证

- [ ] `bun test tests/bdd/` 全量通过（所有 domain feature）
- [ ] 与 `bun lint` + `bun typecheck` 一起加入 pre-commit 门禁

## Verification

```bash
cd apps/server
bun add @cucumber/gherkin
bun test tests/bdd/
# 预期: 全部 BDD scenario 通过
```
