// covers: r213/r216/r218/r219/r223（quality-and-regression）+ r20/r21（bdd-test-harness）——BDD 为可选回归入口（qa 不依赖 test-bdd、配方独立可用）与集成测试经 just test 计入门禁。
import { describe, expect, it } from 'bun:test';
// Gate composition lock — 结构性事实：just qa 门禁组成与 just test 范围。
// 瘦身说明：原 r214/r215/r220/r221/r223 段（断言 package.json script 字符串、
// lint 工具名、BDD 配方存在性）为纯配置镜像，已删；工具链契约以 spec
// quality-and-regression r214/r215 为准，不再用测试复读。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

const justfile = readFileSync(join(REPO_ROOT, 'justfile'), 'utf8');

interface Recipe {
  deps: string[];
  body: string;
}

/** Parse one justfile recipe: its dependency list and its indented body. */
function recipe(name: string): Recipe {
  const lines = justfile.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${name}(?:\\s+\\S+)*:`).test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const header = lines[start];
  const depsPart = header.slice(header.indexOf(':') + 1);
  const deps = depsPart.trim().split(/\s+/u).filter(Boolean);
  const bodyLines: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.startsWith('    ')) {
      bodyLines.push(line);
    } else {
      break;
    }
  }
  return { deps, body: bodyLines.join('\n') };
}

describe('r213+r216+r218 just qa composition', () => {
  it('qa pulls in check (typecheck/lint/format) + test + test-web + drift checks', () => {
    const qa = recipe('qa');
    expect(qa.deps).toContain('check');
    expect(qa.deps).toContain('test');
    expect(qa.deps).toContain('test-web');
    expect(qa.deps).toContain('check-env-examples');
    expect(qa.deps).toContain('check-app-schema');
    const check = recipe('check');
    expect(check.deps).toContain('typecheck');
    expect(check.deps).toContain('lint');
    expect(check.deps).toContain('format-check');
    expect(recipe('check-env-examples').body).toContain('--check');
    expect(recipe('check-app-schema').body).toContain('--check');
  });
});

describe('r219 just test scope is server+shared only', () => {
  it('just test covers server tests and shared tests, not web Rstest or e2e', () => {
    const test = recipe('test');
    expect(test.body).toContain('bun test');
    expect(test.body).toContain('apps/server/tests/');
    expect(test.body).toContain('packages/shared/test/');
    expect(test.body).not.toMatch(/apps\/web/u);
    expect(test.body).not.toContain('e2e');
    expect(test.deps).not.toContain('test-web');
    expect(test.deps).not.toContain('e2e');
    // r219 细则：BDD 子集经 --path-ignore-patterns 排除在 just test 外（独立走 test-bdd）。
    expect(test.body).toContain('--path-ignore-patterns');
    expect(test.body).toContain('apps/server/tests/bdd');
  });
});

describe('r223 BDD and type-aware lint stay out of the primary gate', () => {
  it('qa does not depend on test-bdd/type-aware-lint; both remain separate entrypoints', () => {
    const qa = recipe('qa');
    expect(qa.deps).not.toContain('test-bdd');
    expect(qa.deps).not.toContain('type-aware-lint');
    expect(recipe('test-bdd').body).toContain('bun test');
    expect(recipe('type-aware-lint').body).toContain('lint:type-aware');
  });
});
