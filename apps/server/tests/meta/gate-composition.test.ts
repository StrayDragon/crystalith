import { describe, expect, it } from 'bun:test';
// Gate composition lock tests — structural facts about the justfile QA gate
// and the frontend test-suite entrypoints (quality-and-regression).
//
// These are read-only structural assertions over repo files: recipes exist,
// dependency lists contain the required tokens, and recipe bodies carry the
// key command substrings. They intentionally do NOT lock full file bytes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

const justfile = readRepoFile('justfile');
const rootPkg = JSON.parse(readRepoFile('package.json')) as { scripts: Record<string, string> };
const webPkg = JSON.parse(readRepoFile('apps/web/package.json')) as {
  scripts: Record<string, string>;
};

interface Recipe {
  deps: string[];
  body: string;
}

/** Parse one justfile recipe: its dependency list and its indented body. */
function recipe(name: string): Recipe {
  const lines = justfile.split('\n');
  // Recipe header: `name:` (optionally with params like `*args:`), deps after
  // the colon on the same line. All recipes asserted here use single-line deps.
  const start = lines.findIndex((line) => new RegExp(`^${name}(?:\\s+\\S+)*:`).test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const header = lines[start];
  const depsPart = header.slice(header.indexOf(':') + 1);
  const deps = depsPart.trim().split(/\s+/u).filter(Boolean);
  // Body: consecutive 4-space-indented (non-empty) lines below the header.
  const bodyLines: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      // Blank lines inside a recipe body keep it going; a blank line followed
      // by a non-indented line ends it on the next iteration.
      continue;
    }
    if (line.startsWith('    ')) {
      bodyLines.push(line);
    } else {
      break;
    }
  }
  return { deps, body: bodyLines.join('\n') };
}

describe('r213 lint/format are part of the quality gate', () => {
  it('just qa pulls in check, and check runs typecheck + lint + format-check', () => {
    // covers: r213
    const qa = recipe('qa');
    expect(qa.deps).toContain('check');
    const check = recipe('check');
    expect(check.deps).toContain('typecheck');
    expect(check.deps).toContain('lint');
    expect(check.deps).toContain('format-check');
  });
});

describe('r214 JS/TS lint entrypoint is root oxlint', () => {
  it('root lint script is oxlint and just lint delegates to bun lint', () => {
    // covers: r214
    expect(rootPkg.scripts.lint).toBe('oxlint');
    const lint = recipe('lint');
    expect(lint.body).toContain('bun lint');
  });

  it('apps/web still exposes incremental/full lint entrypoints', () => {
    // covers: r214
    expect(typeof webPkg.scripts.lint).toBe('string');
    expect(typeof webPkg.scripts['lint:all']).toBe('string');
  });
});

describe('r215 formatting checks use oxfmt', () => {
  it('root format:check is oxfmt --check and just format-check delegates to it', () => {
    // covers: r215
    expect(rootPkg.scripts['format:check']).toBe('oxfmt --check');
    expect(rootPkg.scripts['format:write']).toBe('oxfmt --write');
    const formatCheck = recipe('format-check');
    expect(formatCheck.body).toContain('bun format:check');
  });
});

describe('r216 primary gate runs server/shared tests and web Rstest', () => {
  it('just qa depends on test and test-web, and test-web runs the Rstest CI suite', () => {
    // covers: r216
    const qa = recipe('qa');
    expect(qa.deps).toContain('test');
    expect(qa.deps).toContain('test-web');
    expect(typeof webPkg.scripts['test:ci']).toBe('string');
    const testWeb = recipe('test-web');
    expect(testWeb.body).toContain('rstest run');
  });
});

describe('r218 config/env drift checks are mandatory gate steps', () => {
  it('just qa depends on check-env-examples and check-app-schema, both with --check', () => {
    // covers: r218
    const qa = recipe('qa');
    expect(qa.deps).toContain('check-env-examples');
    expect(qa.deps).toContain('check-app-schema');
    expect(recipe('check-env-examples').body).toContain('--check');
    expect(recipe('check-app-schema').body).toContain('--check');
  });
});

describe('r219 just test scope is server+shared only', () => {
  it('just test covers server tests and shared tests, not web Rstest or e2e', () => {
    // covers: r219
    const test = recipe('test');
    expect(test.body).toContain('bun test');
    expect(test.body).toContain('apps/server/tests/');
    expect(test.body).toContain('packages/shared/test/');
    // Scope exclusions: no web suite, no browser e2e in the local default entry.
    expect(test.body).not.toMatch(/apps\/web/u);
    expect(test.body).not.toContain('e2e');
    expect(test.deps).not.toContain('test-web');
    expect(test.deps).not.toContain('e2e');
  });
});

describe('r220 frontend suites are tiered and reproducible', () => {
  it('test:ci fails on unhandled requests and runs the mock-reason gate', () => {
    // covers: r220
    const testCi = webPkg.scripts['test:ci'];
    expect(testCi).toContain('RSTEST_MSW_ON_UNHANDLED=error');
    expect(testCi).toContain('test-mock-report-check');
    // Core subset entry exists (MAY-level tiering).
    expect(typeof webPkg.scripts['test:core']).toBe('string');
  });

  it('just test-web reproduces the same gates at the repo level', () => {
    // covers: r220
    const testWeb = recipe('test-web');
    expect(testWeb.body).toContain('RSTEST_MSW_ON_UNHANDLED=error');
    expect(testWeb.body).toContain('test_mock_report.mjs --check-mock-reasons');
  });
});

describe('r221 test-double usage is observable', () => {
  it('web exposes deterministic mock-report entrypoints and test:ci runs the check', () => {
    // covers: r221
    expect(typeof webPkg.scripts['test-mock-report']).toBe('string');
    expect(typeof webPkg.scripts['test-mock-report-check']).toBe('string');
    expect(webPkg.scripts['test-mock-report-check']).toContain('--check-mock-reasons');
    expect(webPkg.scripts['test:ci']).toContain('test-mock-report-check');
  });
});

describe('r223 BDD and type-aware lint stay out of the primary gate', () => {
  it('just qa does not depend on test-bdd or type-aware-lint', () => {
    // covers: r223
    const qa = recipe('qa');
    expect(qa.deps).not.toContain('test-bdd');
    expect(qa.deps).not.toContain('type-aware-lint');
  });

  it('both remain available as separate entrypoints', () => {
    // covers: r223
    expect(recipe('test-bdd').body).toContain('bun test');
    expect(recipe('type-aware-lint').body).toContain('lint:type-aware');
  });
});
