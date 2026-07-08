## Approach

v2 数据层只支持 SQLite（桌面 app 定位），使用 Drizzle ORM + bun:sqlite 驱动 + sqlite-vec 向量扩展。

### Drizzle Setup Pattern

最佳实践来自 Drizzle 官方文档 + bun-sqlite 驱动签名：

```ts
// server/src/db/index.ts
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as sqliteVec from 'sqlite-vec';
import * as schema from './schema';

const db = new Database('data/crystalith.db', { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
sqliteVec.load(db);

export const orm = drizzle({ client: db, schema });

// Auto-migrate on startup
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
migrate(orm, { migrationsFolder: './drizzle' });
```

关键点：
- `drizzle({ client: db })` 是 bun-sqlite 的正确初始化签名（v0.45+）
- `migrate()` 自动 apply 所有未执行的迁移
- WAL mode 必须在连接后立即开启

### Schema 模式

使用 `sqliteTable` + column builders + `relations()`：

```ts
// server/src/db/schema/core.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const notebooks = sqliteTable('notebooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  notebook_id: integer('notebook_id')
    .notNull()
    .references(() => notebooks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mime_type: text('mime_type'),
  parser_type: text('parser_type').notNull(),
  metadata_: text('metadata_', { mode: 'json' }).$type<Record<string, unknown>>(),
  dedup_key: text('dedup_key'),
  status: text('status', { enum: ['processing', 'ready', 'failed'] }).notNull(),
  error_code: text('error_code'),
  error_message: text('error_message'),
  recovery_hint: text('recovery_hint'),
  last_error_at: integer('last_error_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

// relations.ts
import { relations } from 'drizzle-orm';
export const notebookRelations = relations(notebooks, ({ many }) => ({
  sources: many(sources),
}));
```

### sqlite-vec 集成

sqlite-vec 虚拟表不由 Drizzle schema 管理，通过裸 SQL 创建 + Drizzle `sql` 模板查询：

```ts
// server/src/db/vectors.ts
import { sql } from 'drizzle-orm';

export function initVectors(orm: ReturnType<typeof drizzle>) {
  orm.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      embedding float[1024],
      notebook_id integer partition by,
      source_id integer partition by
    );
  `);
}

export function searchVectors(
  orm: ReturnType<typeof drizzle>,
  queryVec: Float32Array,
  notebookId: number,
  topK: number = 10,
) {
  return orm.all<{ rowid: number; source_id: number; distance: number; text: string }>(sql`
    SELECT v.rowid, v.source_id, v.distance, c.text
    FROM vec_chunks v
    JOIN chunks c ON c.id = v.rowid
    WHERE v.embedding MATCH ${queryVec} AND v.k = ${topK} AND v.notebook_id = ${notebookId}
    ORDER BY v.distance
  `);
}
```

### Migration 工作流

```bash
bunx drizzle-kit generate   # diff schema → SQL
bunx drizzle-kit migrate    # apply
```

初始迁移从空库生成（不迁移 alembic 历史）。后续 schema 变更通过 `generate` + `migrate`。

### Migration note

- BREAKING: Postgres 支持移除。v1 数据通过一次性脚本迁移
- epochs 用 `integer` Unix timestamp（SQLite 原生）
- JSON 列用 `text({ mode: 'json' })` + `$type<T>()`
- Relationships 用 `relations()` + query API 的 `with`
