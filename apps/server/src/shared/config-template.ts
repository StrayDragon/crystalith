// Template renderer — simplified Jinja2 subset, matching v1 app.yaml:
//   {{ env.KEY }}                        — process.env + .env overlay
//   {{ env.KEY | default('fallback') }}  — with default
//
// The legacy `{{ secret.* }}` namespace (config/secret.env) was removed;
// resolveLookup throws if a template still references it.

import { envValue } from './config-env.ts';

/** Render all `{{ ... }}` expressions in a string. */
export function renderTemplates(source: string): string {
  return source.replaceAll(/\{\{([^}]+)\}\}/gu, (_match, expr: string) => {
    return String(resolveExpression(expr.trim()));
  });
}

/**
 * Resolve a single template expression like
 * `env.KEY | default(secret.X | default('fallback'))`.
 */
function resolveExpression(expr: string): unknown {
  const pipeParts = splitTopLevel(expr, '|').map((s) => s.trim());
  const head = pipeParts[0];
  const filters = pipeParts.slice(1);

  let value: unknown = resolveLookup(head);

  for (const filter of filters) {
    value = applyFilter(value, filter);
  }
  return value;
}

/** Split on `|` but not inside parentheses or quotes. */
function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let current = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/** Resolve `env.KEY` or a bare string literal. */
function resolveLookup(head: string): unknown {
  const envMatch = head.match(/^env\.([A-Za-z_][A-Za-z0-9_]*)$/u);
  if (envMatch) return envValue(envMatch[1]);

  const secretMatch = head.match(/^secret\.([A-Za-z_][A-Za-z0-9_]*)$/u);
  if (secretMatch) {
    throw new Error(
      `config template references '${head}' — the secret.* namespace (config/secret.env) was removed; use env.${secretMatch[1]} (shell export or .env)`,
    );
  }

  // Bare quoted string literal.
  if (
    (head.startsWith("'") && head.endsWith("'")) ||
    (head.startsWith('"') && head.endsWith('"'))
  ) {
    return head.slice(1, -1);
  }
  return head;
}

/** Apply a single `filter(...)` expression. */
function applyFilter(value: unknown, filter: string): unknown {
  const m = filter.match(/^([A-Za-z_]+)\((.*)\)$/u);
  if (!m) return value;
  const [, name, argStr] = m;
  if (name === 'default') {
    if (value === undefined || value === null || value === '') {
      // The arg can itself be a nested expression.
      return resolveExpression(argStr.trim());
    }
    return value;
  }
  return value;
}
