// Structured JSON logger — zero-dependency, Bun/TS7-proof.
//
// Output: single-line JSON per event on stdout/stderr, 12factor-friendly.
// Level resolution order: explicit setLogLevel() > CL_LOG_LEVEL env >
//   NODE_ENV==='test' ? 'warn' (keep test output clean) > 'info'.
//
// Scope note: this is the HTTP-layer logging foundation (access log +
// onError correlation). Service-layer call sites may adopt it incrementally
// when request context propagation lands; plain console.* there still works.

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

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;
  const entry = { ts: new Date().toISOString(), level, msg, ...fields };
  const line = JSON.stringify(entry);
  // Route by severity so stderr-based collectors only see problems.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Bind constant fields (e.g. requestId) into every entry of a child logger. */
  child(bound: LogFields): Logger;
}

function makeLogger(bound: LogFields): Logger {
  const log =
    (level: LogLevel) =>
    (msg: string, fields?: LogFields): void =>
      emit(level, msg, { ...bound, ...fields });
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: (extra: LogFields) => makeLogger({ ...bound, ...extra }),
  };
}

export const logger: Logger = makeLogger({});
