// Env inputs for config loading: CL_* process env + a .env overlay (parsed,
// never mutated into process.env). Paths resolve lazily so the overlay is
// ready before anything reads CL_CONFIG_PATH.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Parse a dotenv file into a record (does not mutate process.env). */
function parseDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf-8');
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let _envOverlay: Record<string, string> | null = null;
/** Look up .env — try CWD first, then walk up to repo root. */
function findDotenv(): string {
  const cwd = process.cwd();
  // Fast path: .env at CWD
  if (existsSync('.env')) return '.env';
  // Walk up from CWD to find repo root (has .git or package.json at top)
  let dir = cwd;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback
  return '.env';
}

let _envPath: string | null = null;
function envPath(): string {
  _envPath ??= findDotenv();
  return _envPath;
}

function envOverlay(): Record<string, string> {
  _envOverlay ??= parseDotenv(envPath());
  return _envOverlay;
}

export function envValue(key: string): string | undefined {
  return process.env[key] ?? envOverlay()[key];
}

/** Drop the cached .env overlay (tests / config hot-reload). */
export function resetEnvOverlay(): void {
  _envOverlay = null;
}

export function getConfigPath(): string {
  return envValue('CL_CONFIG_PATH') ?? 'config/app.yaml';
}

// Lazy init — resolve paths after env overlay is ready.
let _configPath: string | null = null;
export function configPath(): string {
  _configPath ??= getConfigPath();
  return _configPath;
}
