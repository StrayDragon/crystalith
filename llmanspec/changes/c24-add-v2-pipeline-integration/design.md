# c24 design — v2 特化管线整合

## Workstream A: Content Storage Layer

### 选型

```
Option 1: SQLite BLOB (storage table)     Option 2: Filesystem (local dir)     ✅
─────────────────────────────────         ────────────────────────────────
+ 单文件存储（一个 .db 文件）              + 文件系统对大文件友好
+ 备份简单                                  + 可以用 OS 工具查看/管理
- 大文件拖慢 DB query                      + Bun 的 Bun.write/read 非常快
- 迁移复杂                                  - 需要管理存储路径
                                            - 多用户需隔离
```

最终选 **Option 2：本地文件系统**。原因：

1. ~~v1 也是文件系统（`backend/py/storage/`）~~ **【已勘误】** v1 实际无原始字节持久化（无 `backend/py/storage/` 目录、`Source` 模型无 raw-bytes 列，解析后丢弃）。本层是 **v2 独有设计**（单二进制架构需要可重解析的存储抽象），非 v1 对齐。
2. Bun 的读写 API 极其快（底层 io_uring）
3. 桌面 app `~/.crystalith/storage/` 路径合理
4. 大文件不会阻塞 SQLite

### 接口

```ts
// shared/storage.ts
export interface Storage {
  save(sourceId: number, buffer: Uint8Array): Promise<string>; // 返回路径
  fetch(sourceId: number): Promise<Uint8Array>; // 读取
  delete(sourceId: number): Promise<void>; // 删除
  exists(sourceId: number): Promise<boolean>;
}

export class LocalStorage implements Storage {
  constructor(private basePath: string = '') {}
  // ...
}

// 全局单例
export const contentStorage = new LocalStorage(
  process.env.CL_STORAGE_PATH || join(homedir(), '.crystalith', 'storage'),
);
```

### 接入 pipeline.ts

当前：pipeline.ts 的 `ingestSource` 接收 `buffer: Uint8Array`，parse 后不保存。

改为：

1. Parse 完成后 → `contentStorage.save(sourceId, buffer)`（持久化原始文件）
2. 后续需要重新 parse（如 document_parse 任务）→ `contentStorage.fetch(sourceId)` → parse → chunk → embed

### 接入 worker.ts document_parse

当前：stub，直接 throw。

改为：

```ts
case 'document_parse':
  const buffer = await contentStorage.fetch(sourceId);
  const parser = selectParser(mimeType, filename);
  const result = await parser.parse(buffer, filename);
  // chunk + insert + embed (同 pipeline.ts)
  // 通过 stageLimiters.embedding.acquire() 控制 embed 并发
```

## Workstream B: toolApproval HITL

### AI SDK v7 原生流程

```
Agent → 调用 approvePlan tool
  → AI SDK 发出 { type: 'tool-approval-request', toolName: 'approvePlan' }
  → 前端收到 SSE 事件，显示审批 UI → 用户点击"批准"
  → AI SDK 调用 tool.execute() → 继续循环
```

### 前端变化

当前：前端 `/research/:id/stream` 的 SSE 事件是自定义的 `plan_ready`/`approval_request`。

改为：前端 `/research/:id/stream` 直接 relay AI SDK `fullStream` 事件：

- `tool-call` → 搜索进度
- `tool-approval-request` → 审批弹窗
- `text-delta` → 报告内容流
- `tool-result` → 搜索结果

### 后端变化

```ts
// agent.ts → runResearch 中
const agent = new ToolLoopAgent({
  model,
  instructions: RESEARCH_SYSTEM,
  tools: { webSearch, approvePlan: tool({...}) },
  toolApproval: {
    webSearch: 'not-applicable',      // 自动执行
    approvePlan: 'user-approval',     // 等用户批准
  },
});
// 不再需要 DB polling waitForApproval
```

### DB 锁彻底移除

v1 `locked_at`/`lock_expires_at` 字段已存在于 schema 但全为 NULL。
t24 确认不移除表结构（迁移成本 > 收益），但逻辑上彻底不用。

## Workstream C: 集成测试

### AI SDK Mock 策略

```ts
// test/helpers/mock-ai.ts
mock.module('ai', () => ({
  generateObject: async ({ schema }) => ({
    object: schema.parse(MOCK_DATA[context.prompt]),
  }),
  streamText: () => MOCK_STREAM,
  ToolLoopAgent: class {
    async generate() {
      return MOCK_RESULT;
    }
  },
}));
```

每个集成测试文件覆盖一个完整用户场景：

| 测试                     | 场景                                                     |
| :----------------------- | :------------------------------------------------------- |
| qa/handler.test.ts       | 选择来源 → 提问 → 检索 → 生成回答 → 置信度 ≥ 0.3         |
| sources/ingest.test.ts   | 上传文件 → parse → chunk → dedup (409 on repeat)         |
| refine/queue.test.ts     | 请求 refine → 队列异步执行 → 轮询完成 → 返回结果         |
| research/hitl.test.ts    | 创建研究 → plan 生成 → approve → 搜索 → analyze → report |
| research/cancel.test.ts  | 创建研究 → cancel → status=cancelled                     |
| studio/two-stage.test.ts | outline 生成 → review → markdown 生成 → 完整 slide       |

## 验证

```bash
bun test test/              # 全量（103 旧 + 新集成测试）
bun test tests/bdd/          # BDD（21）
bun typecheck                # 类型检查
bun run build                # 二进制编译
```
