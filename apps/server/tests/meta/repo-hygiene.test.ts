import { describe, expect, it } from 'bun:test';
// Public repo hygiene lock tests — contribution entrypoint, issue/PR templates,
// and release-artifact self-containment (public-repo-hygiene).
//
// Read-only structural assertions over repo files. They verify presence,
// non-emptiness, and the key actionable substrings — not full file bytes.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

function repoFileBytes(relPath: string): number {
  const path = join(REPO_ROOT, relPath);
  expect(existsSync(path)).toBe(true);
  return statSync(path).size;
}

describe('r208 repo provides a clear contribution entrypoint', () => {
  it('README.md and AGENTS.md exist, are non-trivial, and carry dev/test/commit guidance', () => {
    // covers: r208
    expect(repoFileBytes('README.md')).toBeGreaterThan(1000);
    expect(repoFileBytes('AGENTS.md')).toBeGreaterThan(1000);
    const readme = readRepoFile('README.md');
    // Minimal development + testing guidance: install, dev, and the PR gate.
    expect(readme).toContain('bun install');
    expect(readme).toContain('just dev');
    expect(readme).toContain('just qa');
    const agents = readRepoFile('AGENTS.md');
    // Commit guidance lives in AGENTS.md (README links it as the conventions doc).
    expect(agents).toContain('Commit Guidelines');
    expect(agents).toContain('feat:');
  });
});

describe('r210 issue and PR templates capture actionable information', () => {
  it('PR template exists with testing/checklist sections including the local qa gate', () => {
    // covers: r210
    expect(repoFileBytes('.github/pull_request_template.md')).toBeGreaterThan(100);
    const prTemplate = readRepoFile('.github/pull_request_template.md');
    expect(prTemplate).toContain('Testing');
    // The PR checklist demands the local primary gate (no remote CI assumption).
    expect(prTemplate).toContain('just qa');
  });

  it('issue templates exist and ask for repro steps, expected vs actual, and environment', () => {
    // covers: r210
    expect(repoFileBytes('.github/ISSUE_TEMPLATE/bug_report.yml')).toBeGreaterThan(100);
    expect(repoFileBytes('.github/ISSUE_TEMPLATE/feature_request.yml')).toBeGreaterThan(100);
    const bug = readRepoFile('.github/ISSUE_TEMPLATE/bug_report.yml');
    expect(bug).toContain('reproduce');
    expect(bug).toContain('Expected behavior');
    expect(bug).toContain('Environment');
  });
});

describe('r212 release artifacts are self-contained and key-free', () => {
  it('build-release stages the minimal resource set beside the binary', () => {
    // covers: r212
    const src = readRepoFile('scripts/build-release.ts');
    // Resource set: server binary, web static assets, DB migrations, sqlite-vec
    // platform extension, runtime config.
    expect(src).toContain('crystalith-server');
    expect(src).toContain(`'web', 'dist'`);
    expect(src).toContain(`'drizzle'`);
    expect(src).toContain('vec0');
    // Runtime config is staged via an explicit allowlist — never a whole-dir copy.
    expect(src).toContain(`'app.yaml', 'app.schema.gen.json'`);
    expect(src).not.toContain(`path.join(repoRoot, 'config')`);
  });

  it('README documents the same archive layout and states it is key-free', () => {
    // covers: r212
    const readme = readRepoFile('README.md');
    expect(readme).toContain('crystalith-server');
    expect(readme).toContain('web/dist/');
    expect(readme).toContain('drizzle/');
    expect(readme).toContain('native/vec0');
    expect(readme).toContain('config/app.yaml');
    expect(readme).toContain('不含任何密钥');
    // Version single-source: release git tag injected into /health and OpenAPI.
    expect(readme).toContain('版本号来自发布 tag');
  });
});
