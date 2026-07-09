import { describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// BDD runner — Gherkin (.feature) → bun:test bridge.
//
// Ports v1's pytest-bdd semantics to a self-contained ~200-line runner:
//   - Parses # language: zh-CN features via @cucumber/gherkin (parser only).
//   - Maps 假如/当/那么/而且 keywords to Given/When/Then/And step kinds.
//   - Step patterns support "{name}" (string) and "{name:d}" (integer)
//     placeholders, compiled to capture-group regexes.
//   - A TestContext carries the response bus (When stores, Then asserts) and
//     fixture store (Given-produced entities referenced by later steps).
//   - DocStrings are passed as the final string argument.
//   - {fixture[key]} path templates are resolved against ctx.fixtures.
import { AstBuilder, Parser, GherkinClassicTokenMatcher } from '@cucumber/gherkin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepKind = 'given' | 'when' | 'then';

/** HTTP-shaped response stored on ctx.response by When steps. */
export interface BddResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
  raw?: unknown;
}

export interface TestClient {
  get(path: string): Promise<BddResponse>;
  post(path: string, body?: unknown): Promise<BddResponse>;
  patch(path: string, body?: unknown): Promise<BddResponse>;
  delete(path: string): Promise<BddResponse>;
  /** Raw SSE stream consumption — returns collected event/data pairs. */
  postStream(path: string, body?: unknown): Promise<BddResponse>;
}

/** Per-scenario mutable state shared across steps (the v1 conftest model). */
export interface TestContext {
  response: BddResponse | null;
  fixtures: Record<string, Record<string, unknown>>;
  client: TestClient;
}

export type StepFn = (ctx: TestContext, ...args: (string | number)[]) => Promise<void> | void;

interface StepDef {
  kind: StepKind;
  pattern: RegExp;
  raw: string;
  paramNames: string[];
  fn: StepFn;
  /** Optional: store the step's return value into ctx.fixtures[target]. */
  target?: string;
}

// ---------------------------------------------------------------------------
// Pattern compilation — "{name}" / "{name:d}" → capture regex
// ---------------------------------------------------------------------------

interface CompiledPattern {
  regex: RegExp;
  paramNames: string[];
}

function compilePattern(pattern: string): CompiledPattern {
  const paramNames: string[] = [];
  // Escape regex specials, then translate our two placeholder forms.
  // "{name}"  → non-greedy string capture (excludes the closing quote)
  // "{name:d}" → integer capture
  let regexSrc = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end === -1) {
        regexSrc += '\\{';
        i += 1;
        continue;
      }
      const inner = pattern.slice(i + 1, end);
      // Param names use CJK + word chars (v1 used Chinese names like 名称).
      const dMatch = inner.match(/^([\w\u4e00-\u9fff]+):d$/);
      if (dMatch) {
        paramNames.push(dMatch[1]);
        regexSrc += '(\\d+)';
      } else if (/^[\w\u4e00-\u9fff]+$/.test(inner)) {
        paramNames.push(inner);
        // Match content up to the next quote or end-of-line, non-greedy.
        regexSrc += '([^"]*)';
      } else {
        // Unknown form — escape literally.
        regexSrc += pattern.slice(i, end + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      i = end + 1;
    } else {
      regexSrc += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return { regex: new RegExp(`^${regexSrc}$`), paramNames };
}

// ---------------------------------------------------------------------------
// Path template resolution — {fixture[key]} → ctx.fixtures[fixture][key]
//
// Fixture + key names may be CJK (e.g. {当前笔记本[id]}), so the character
// class mirrors compilePattern's param support (\w + CJK Unified Ideographs).
// ---------------------------------------------------------------------------

const PATH_TEMPLATE_RE = /\{([\w\u4E00-\u9FFF]+)\[([\w\u4E00-\u9FFF]+)\]\}/g;

export function resolvePath(path: string, ctx: TestContext): string {
  return path.replace(PATH_TEMPLATE_RE, (match, fixtureName: string, key: string) => {
    const fixture = ctx.fixtures[fixtureName];
    if (fixture && fixture[key] !== null && fixture[key] !== undefined) return String(fixture[key]);
    return match;
  });
}

// ---------------------------------------------------------------------------
// Registry + runner
// ---------------------------------------------------------------------------

const registry: StepDef[] = [];
let counter = 0;

function register(kind: StepKind, pattern: string, fn: StepFn, target?: string) {
  const compiled = compilePattern(pattern);
  registry.push({
    kind,
    pattern: compiled.regex,
    raw: pattern,
    paramNames: compiled.paramNames,
    fn,
    target,
  });
}

export const bdd = {
  given(pattern: string, fn: StepFn, target?: string) {
    register('given', pattern, fn, target);
  },
  when(pattern: string, fn: StepFn) {
    register('when', pattern, fn);
  },
  // Named `thenStep` (not `then`) so the registry object isn't mistaken for
  // a Promise thenable — unicorn's no-thenable / catch-error-name rules would
  // otherwise flag every step callback's first param as a catch error.
  thenStep(pattern: string, fn: StepFn) {
    register('then', pattern, fn);
  },
};

function matchStep(kind: StepKind, text: string): StepDef | null {
  // And (*) inherits the preceding step's kind — we match any kind since
  // Gherkin's "*" / "And" / "But" keyword is descriptive, not structural.
  // v1 treats them the same way (registered under the real keyword).
  for (const def of registry) {
    if (def.kind !== kind) continue;
    const m = def.pattern.exec(text);
    if (m) return def;
  }
  // Fallback: match across all kinds (handles "And" which has no fixed kind).
  for (const def of registry) {
    const m = def.pattern.exec(text);
    if (m) return def;
  }
  return null;
}

async function runStep(def: StepDef, text: string, docString: string | null, ctx: TestContext) {
  const m = def.pattern.exec(text);
  if (!m) throw new Error(`step pattern failed to rematch: ${def.raw}`);
  const args: (string | number)[] = def.paramNames.map((name, idx) => {
    const raw = m[idx + 1];
    // Integer params were declared with the {name:d} form in the pattern.
    return def.raw.includes(`{${name}:d}`) ? Number(raw) : raw;
  });
  if (docString !== null) args.push(docString);
  const result = await def.fn(ctx, ...args);
  if (def.target && result && typeof result === 'object') {
    ctx.fixtures[def.target] = result as Record<string, unknown>;
  }
}

// Gherkin keyword (trimmed) → step kind. And/But/* inherit from the most
// recent concrete kind.
function keywordToKind(keyword: string, prevKind: StepKind): StepKind {
  const kw = keyword.trim();
  // Chinese (zh-CN) + English keyword coverage.
  if (/^(假如|Given)/u.test(kw)) return 'given';
  if (/^(当|When)/u.test(kw)) return 'when';
  if (/^(那么|Then)/u.test(kw)) return 'then';
  // 而且/并且/But/* inherit previous kind.
  return prevKind;
}

function parseFeature(featurePath: string) {
  const src = readFileSync(featurePath, 'utf8');
  const parser = new Parser(
    new AstBuilder(() => `n-${++counter}`),
    new GherkinClassicTokenMatcher(),
  );
  return parser.parse(src);
}

/**
 * Load step definitions from a module (side-effect import), then run every
 * scenario in the feature file as a bun:test test().
 *
 * Step modules must be imported before runFeature is called so the registry
 * is populated. A typical entry file:
 *
 *   import './steps/common.ts';
 *   import { runFeature } from './runner.ts';
 *   runFeature('features/notebooks/笔记本管理.feature');
 */
export function runFeature(
  featurePath: string,
  makeContext: () => TestContext,
  options: { skipScenarios?: RegExp } = {},
) {
  const doc = parseFeature(featurePath);
  const feature = doc.feature;
  if (!feature) return;

  describe(feature.name, () => {
    for (const child of feature.children) {
      const scenario = child.scenario;
      if (!scenario) continue; // skip Background / Rule containers

      const shouldSkip =
        options.skipScenarios?.test(scenario.name) ||
        (scenario.tags ?? []).some((t) => t.name === '@skip' || t.name === '@experimental');

      const runScenario = async () => {
        const ctx = makeContext();
        let prevKind: StepKind = 'given';

        // Background steps (if any) run before each scenario.
        for (const bg of feature.children) {
          if (bg.background) {
            for (const step of bg.background.steps) {
              prevKind = keywordToKind(step.keyword, prevKind);
              const def = matchStep(prevKind, step.text);
              if (!def) throw new Error(`No step definition for: ${step.keyword}${step.text}`);
              await runStep(def, step.text, step.docString?.content ?? null, ctx);
            }
          }
        }

        for (const step of scenario.steps) {
          prevKind = keywordToKind(step.keyword, prevKind);
          const def = matchStep(prevKind, step.text);
          if (!def) throw new Error(`No step definition for: ${step.keyword}${step.text}`);
          await runStep(def, step.text, step.docString?.content ?? null, ctx);
        }
      };

      if (shouldSkip) {
        test.skip(scenario.name, runScenario);
      } else {
        test(scenario.name, runScenario);
      }
    }
  });
}
