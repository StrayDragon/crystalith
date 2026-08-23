// Structured JSON logger — zero-dependency, Bun/TS7-proof.
//
// Output: single-line JSON per event on stdout/stderr, 12factor-friendly.
// Level resolution order: explicit setLogLevel() > CL_LOG_LEVEL env >
//   NODE_ENV==='test' ? 'warn' (keep test output clean) > 'info'.
//
// Request correlation: when AsyncLocalStorage carries a requestId (injected
// by server.ts onRequest), every log line — including deep service-layer
// calls — automatically carries it. Explicit fields always win.

import { AsyncLocalStorage } from 'node:async_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveInitialLevel(): LogLevel {
  const fromEnv = process.env.CL_LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv && fromEnv in LEVEL_WEIGHT) return fromEnv as LogLevel;
  if (process.env.NODE_ENV === 'test') return 'warn';
  return 'info';
}

let currentLevel: LogLevel = resolveInitialLevel();

/** Override the level programmatically (tests / runtime tuning). */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

/** Request-scoped storage so any log site inherits the active requestId. */
export const requestContext = new AsyncLocalStorage<{ requestId?: string }>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export type LogFields = Record<string, unknown>;

interface Entry {
  ts: string;
  level: LogLevel;
  msg: string;
  [k: string]: unknown;
}

/**
 * Fold legacy/vararg call shapes into fields:
 *   - string        → appended to msg (`a — b`)
 *   - Error         → { errorMessage, errStack }
 *   - other object  → spread
 *   - primitive     → { detail }
 */
function fold(rest: unknown[], fields: LogFields): { msgSuffix: string; fields: LogFields } {
  let msgSuffix = '';
  const out: LogFields = {};
  for (const arg of rest) {
    if (typeof arg === 'string') {
      msgSuffix += (msgSuffix ? ' — ' : ' — ') + arg;
    } else if (arg instanceof Error) {
      msgSuffix += (msgSuffix ? ' — ' : ' — ') + arg.message;
      out.errorMessage = arg.message;
      out.errStack = arg.stack;
    } else if (arg && typeof arg === 'object') {
      Object.assign(out, arg);
    } else if (arg !== undefined) {
      out.detail = arg;
    }
  }
  return { msgSuffix, fields: { ...out, ...fields } };
}

function emit(
  level: LogLevel,
  msg: string,
  bound: LogFields,
  rest: unknown[],
  fields?: LogFields,
): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;
  const { msgSuffix, fields: folded } = fold(rest, fields ?? {});
  const entry: Entry = {
    ts: new Date().toISOString(),
    level,
    msg: msg + msgSuffix,
    ...bound,
  };
  const rid = getRequestId();
  if (rid !== undefined && entry.requestId === undefined) entry.requestId = rid;
  Object.assign(entry, folded);
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  info(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
  /** Bind constant fields (e.g. domain tags) into every entry of a child logger. */
  child(bound: LogFields): Logger;
}

function makeLogger(bound: LogFields): Logger {
  const log =
    (level: LogLevel) =>
    (msg: string, ...rest: unknown[]): void =>
      emit(level, msg, bound, rest);
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: (extra: LogFields) => makeLogger({ ...bound, ...extra }),
  };
}

export const logger: Logger = makeLogger({});
