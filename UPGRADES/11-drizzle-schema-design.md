# 11 — Drizzle ORM Schema 设计

> 本文档把 crystalith 当前的 17 张 SQLAlchemy 表逐一映射为 **Drizzle ORM**（bun:sqlite 驱动）schema，并演示迁移工具链、向量表集成、关系查询模式。
>
> **结论先行**：映射机械、直接。Drizzle 的 schema-first 风格比 SQLAlchemy 的类式更直观，且与 bun:sqlite 原生集成。17 张表里真正属于 MVP 的约 8 张（其余随功能裁剪丢弃）。

## Drizzle vs SQLAlchemy 对照

| | SQLAlchemy（现状） | Drizzle ORM（目标） |
|--|----------|----------|
| 风格 | 类式 + `mapped_column` + MetaData | **schema-first**（顶层 `table()` 定义） |
| 类型推断 | 需 Mapped[T] 注解 | 原生 TS 推断（`.$inferSelect` / `.$inferInsert`） |
| 迁移 | alembic（命令式 .py 文件） | **Drizzle Kit**（`generate` 自动 diff，产出 .sql） |
| SQLite 驱动 | aiosqlite（异步） | **`bun:sqlite`**（同步，零依赖，桌面 app 最佳） |
| 关系查询 | `relationship()` + lazy/eager | `relations()` + `with` query API |
| JSON 列 | `sa.JSON` | `text({ mode: 'json' }).$type<T>()` |
| 学习曲线 | 中（大而全） | 低（SQL-like，贴近原生） |

**核心收益**：① schema 即类型（前后端共享）；② 迁移可读（纯 SQL）；③ bun:sqlite 同步调用简单（单用户桌面 app 无并发压力）。

## 数据库初始化

```typescript
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as sqliteVec from "sqlite-vec";
import * as schema from "./schema";

const db = new Database("crystalith.db");
sqliteVec.load(db);  // 加载向量扩展
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export const orm = drizzle(db, { schema });
```

**关键**：`bun:sqlite` 同步 API，Drizzle 的 bun-sqlite 驱动也是同步。单用户桌面 app 完全够（见 [07](./07-sqlite-vec-benchmark.md) 实测）。未来要异步可换 `drizzle-orm/bun-sqlite` 的 worker 模式或 libsql。

## Schema 定义（17 张表 → Drizzle）

### 辅助：共享类型

```typescript
// schema/_shared.ts
import { sql } from "drizzle-orm";
import { text, integer } from "drizzle-orm/bun-sqlite";

// 所有表共用的时间戳
export const timestamps = {
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(unixepoch())`),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull().default(sql`(unixepoch())`),
};

// JSON 列（带类型推断）
export function typedJson<T>(name: string) {
  return text(name, { mode: "json" }).$type<T>();
}
```

### 核心域（8 张 MVP 表）

```typescript
// schema/core.ts
import { sqliteTable, text, integer } from "drizzle-orm/bun-sqlite";
import { timestamps, typedJson } from "./_shared";

// 1. Notebooks — 顶层容器
export const notebooks = sqliteTable("notebooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ...timestamps,
});

// 2. Sessions — 会话
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebook_id: integer("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title"),
  shared_state: typedJson<SharedState>("shared_state").notNull().default({}),
  shared_state_revision: integer("shared_state_revision").notNull().default(0),
  ...timestamps,
});

// 3. Messages — 问答记录
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  session_id: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  citations: typedJson<Citation[] | null>("citations"),
  ...timestamps,
});

// 4. Sources — 资料核心实体
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebook_id: integer("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime_type: text("mime_type"),
  parser_type: text("parser_type").notNull(),
  metadata: typedJson<SourceMeta | null>("metadata_"),
  dedup_key: text("dedup_key"),
  status: text("status", { enum: ["processing", "ready", "failed"] }).notNull(),
  error_code: text("error_code"),
  error_message: text("error_message"),
  recovery_hint: text("recovery_hint"),
  last_error_at: integer("last_error_at", { mode: "timestamp" }),
  ...timestamps,
});

// 5. Chunks — 文本分块（与向量表 rowid 对应）
export const chunks = sqliteTable("chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source_id: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  chunk_index: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  start_offset: integer("start_offset"),
  end_offset: integer("end_offset"),
  metadata: typedJson<ChunkMeta | null>("metadata_"),
  ...timestamps,
});

// 6. Outputs — 生成结果
export const outputs = sqliteTable("outputs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebook_id: integer("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["FAQ", "BRIEFING", "TIMELINE", "MINDMAP", "QUIZ", "GUIDE", "SLIDES", "PARAGRAPH", "BULLETS", "STRUCTURED"] }).notNull(),
  prompt: text("prompt"),
  chunk_ids: typedJson<number[] | null>("chunk_ids"),
  content: typedJson<OutputContent>("content").notNull(),
  ...timestamps,
});

// 7. PromptPresets — 提示词预设
export const promptPresets = sqliteTable("prompt_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trigger: text("trigger").notNull().unique(),
  description: text("description"),
  system_prompt: text("system_prompt").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

// 8. Templates — 模板
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  config_json: typedJson<TemplateConfig>("config_json").notNull(),
  is_builtin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
```

### 向量表（与 chunks 同 rowid）

```typescript
// schema/vectors.ts —— 注意：这是 sqlite-vec 虚拟表，不由 Drizzle 管 schema
// Drizzle 只管查询接口，表用裸 SQL 建
//
// 建表（应用启动时）：
//   CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
//     embedding float[1024],
//     notebook_id integer partition by,
//     source_id integer partition by
//   );
//
// Drizzle 查询包装：
import { sql } from "drizzle-orm";

export const vectorQueries = {
  // 插入
  insert: (orm, rows: { rowid: number; notebook_id: number; source_id: number; embedding: Uint8Array }[]) =>
    orm.run(sql`INSERT INTO vec_chunks(rowid, notebook_id, source_id, embedding)
                VALUES ${sql.join(rows.map(r => sql`(${r.rowid}, ${r.notebook_id}, ${r.source_id}, ${r.embedding})`), sql`,`)}`),

  // 检索（带 notebook 过滤，见 07 实测：100k 时 30ms）
  search: (orm, q: Uint8Array, notebook_id: number, k = 10) =>
    orm.all<{
      rowid: number; source_id: number; distance: number;
      text: string; chunk_index: number;  // JOIN chunks 得到
    }>(sql`
      SELECT v.rowid, v.source_id, v.distance, c.text, c.chunk_index
      FROM vec_chunks v
      JOIN chunks c ON c.id = v.rowid
      WHERE v.embedding MATCH ${q} AND v.k = ${k} AND v.notebook_id = ${notebook_id}
      ORDER BY v.distance
    `),
};
```

**关键设计**：sqlite-vec 的虚拟表不纳入 Drizzle schema 管理（Drizzle 不认识 `vec0` 类型），但**查询通过 Drizzle 的 `sql` 模板走同一个 db 连接**，事务/连接池一致。`rowid` 与 `chunks.id` 对齐，JOIN 取文本。

### 关系定义（Drizzle 的 `relations()`）

```typescript
// schema/relations.ts
import { relations } from "drizzle-orm";
import { notebooks, sessions, messages, sources, chunks, outputs } from "./core";

export const notebookRelations = relations(notebooks, ({ many }) => ({
  sessions: many(sessions),
  sources: many(sources),
  outputs: many(outputs),
}));

export const sessionRelations = relations(sessions, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sessions.notebook_id], references: [notebooks.id] }),
  messages: many(messages),
}));

export const sourceRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sources.notebook_id], references: [notebooks.id] }),
  chunks: many(chunks),
}));

export const chunkRelations = relations(chunks, ({ one }) => ({
  source: one(sources, { fields: [chunks.source_id], references: [sources.id] }),
}));

// 关系查询示例
import { eq } from "drizzle-orm";
const result = await orm.query.notebooks.findFirst({
  where: eq(notebooks.id, 1),
  with: {
    sources: { with: { chunks: true } },  // 自动 JOIN
    sessions: { with: { messages: true } },
  },
});
```

### 可裁剪表（随功能裁剪丢弃）

以下表对应 [04](./04-feature-trimming.md) 里建议砍/简化的功能，重写时**默认不建**：

| 表 | 对应功能 | 裁剪建议 |
|----|------|------|
| `source_tags` + `source_tag_map` | 标签系统 | ✂️ 砍（用文件夹/notebook 分组） |
| `source_connector_bindings` | Obsidian/本地目录连接器 | ⚠️ 简化（本地目录内置） |
| `notebook_extractor_policies` | 多 extractor 策略 | ✂️ 砍（砍到 2 个 extractor） |
| `ui_event_receipts` | 服务端 UI state 同步 | ✂️ 砍（前端 Zustand 自管） |
| `studio_slides` | 幻灯片工作室 | ✂️ MVP 砍 |
| `research_sessions` + `research_steps` | agentic 研究 | ✂️ MVP 砍 |
| `tasks` | 后台任务队列 | ⚠️ 简化（Bun 异步即可） |

**MVP 实际只需 8 张表**（上面核心域），其余按需补。

## 迁移工具链（Drizzle Kit）

```bash
# 1. 生成初始迁移（对比 schema 与空库，产出 .sql）
bunx drizzle-kit generate

# 产出：drizzle/0000_initial.sql
# 内容是可读的 CREATE TABLE 语句
```

生成的迁移示例：
```sql
-- drizzle/0000_initial.sql
CREATE TABLE `notebooks` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch()),
  `updated_at` INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE `sessions` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `notebook_id` INTEGER NOT NULL REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE cascade,
  ...
);
--> statement-breakpoint
CREATE INDEX `sessions_notebook_id_idx` ON `sessions` (`notebook_id`);
```

```bash
# 2. 应用迁移
bunx drizzle-kit migrate

# 或在代码里启动时自动 migrate
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
migrate(orm, { migrationsFolder: "./drizzle" });
```

**与 alembic 的关键差异**：
- alembic 迁移是 .py（命令式，可写复杂数据迁移）→ Drizzle 是 .sql（声明式，纯 DDL）。
- 复杂数据迁移（如把旧字段拆成新字段）Drizzle 需手写 SQL（`bunx drizzle-kit generate --custom`），但桌面 app 这类迁移罕见。
- **重写即重置**：不迁移 alembic 历史，从空库生成初始 schema。已有用户数据若需保留，写一次性 import 脚本。

## 类型导出（前后端共享）

```typescript
// 从 schema 自动导出类型，前端直接 import
export type Notebook = typeof notebooks.$inferSelect;
export type NewNotebook = typeof notebooks.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type Message = typeof messages.$inferSelect;
// ...
```

**收益**：前端 Zod schema + 后端 Drizzle schema 共享类型，配合 Elysia eden，**端到端类型安全**，干掉 OpenAPI 生成链路（见 [08](./08-web-framework-elysia-vs-hono.md)）。

## 关键模式

### 外键级联删除

```typescript
notebook_id: integer("notebook_id").notNull()
  .references(() => notebooks.id, { onDelete: "cascade" })
```
删 notebook 时自动删其下 sessions/messages/sources/chunks。结合 `PRAGMA foreign_keys = ON;`（bun:sqlite 默认关，需显式开）。

### 布尔列（SQLite 无原生 bool）

```typescript
enabled: integer("enabled", { mode: "boolean" }).notNull().default(true)
// 存为 0/1，Drizzle 自动转 boolean
```

### 时间戳（Unix epoch）

```typescript
created_at: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`)
// 存为 INTEGER 秒数，Drizzle 自动转 Date
```

### 枚举（SQLite 无原生 enum）

```typescript
status: text("status", { enum: ["processing", "ready", "failed"] }).notNull()
// 存为 TEXT，TS 侧推断为联合类型
```

## 迁移工作量估算

| 工作 | 量 |
|------|------|
| 17 表 schema 定义 | ~250 行 TS（机械翻译） |
| 向量表查询包装 | ~50 行 |
| 关系定义 | ~60 行 |
| 初始迁移生成 | 自动（1 条命令） |
| feature repo 层翻译（`features/*/repo.py`） | 每个 ~50-100 行，约 8 个 = 500 行 |

**数据层总迁移量 ~800-1000 行 TS**，相对后端总量（预估 15-20k 行）是小头，且机械、低风险。

## 风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| bun:sqlite 同步阻塞 | 🟢 低 | 单用户桌面 app 无并发（见 [07](./07-sqlite-vec-benchmark.md)） |
| Drizzle Kit 迁移对复杂操作支持弱 | 🟡 中 | 桌面 app 数据迁移罕见；必要时 `--custom` 写 SQL |
| sqlite-vec 虚拟表不归 Drizzle 管 | 🟢 低 | 查询走同一连接的 `sql` 模板（本文已示） |
| 前后端类型同步 | 🟢 低 | Drizzle `$inferSelect` 自动导出 |

## 相关文档
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun 技术栈（bun:sqlite 是 Drizzle 的配套）
- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — SQLAlchemy→Drizzle 的总表对照
- [07-sqlite-vec-benchmark.md](./07-sqlite-vec-benchmark.md) — 向量表性能实测
- [04-feature-trimming.md](./04-feature-trimming.md) — 决定哪些表进 MVP
