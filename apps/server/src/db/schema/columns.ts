// Shared column helpers — sqlite-flavored shorthands used by every domain
// schema module. Timestamps are integer Unix columns (`mode: 'timestamp'`)
// rendered to ISO strings on the API boundary; JSON columns use
// `text({ mode: 'json' })` + `$type<T>()` for type-safe round-tripping.
import type { JsonMetadata } from '@crystalith/shared';
import { integer, text } from 'drizzle-orm/sqlite-core';

/** Nullable JSON column. */
export const json = <T = JsonMetadata>(name: string) => text(name, { mode: 'json' }).$type<T>();

/** Non-null JSON column. */
export const jsonReq = <T = JsonMetadata>(name: string) =>
  text(name, { mode: 'json' }).$type<T>().notNull();

export const ts = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());

export const tsUpd = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

export const tsNull = (name: string) => integer(name, { mode: 'timestamp' });

export const bool = (name: string, def: boolean) =>
  integer(name, { mode: 'boolean' }).notNull().default(def);
