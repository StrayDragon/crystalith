// Web static hosting (single-binary web mode) unit tests.
//
// The `/*` catch-all serves CL_WEB_DIST assets + SPA history fallback, while
// API prefixes keep the JSON ErrorEnvelope 404 — the key regression guard is
// that an unknown /v2 path must never render index.html.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../../src/server.ts';
import { isApiPath, resolveWebDistRoot } from '../../src/shared/web-static.ts';

const BASE = 'http://test.local';
let distRoot: string;
let app: InstanceType<typeof createApp>;
let prevEnv: string | undefined;

beforeAll(() => {
  distRoot = mkdtempSync(join(tmpdir(), 'crystalith-web-dist-'));
  writeFileSync(join(distRoot, 'index.html'), '<html>crystalith-spa</html>');
  mkdirSync(join(distRoot, 'assets'));
  writeFileSync(join(distRoot, 'assets', 'app-abc123.js'), 'console.log("bundle");');
  // Rsbuild dist layout: content-hashed assets under static/.
  mkdirSync(join(distRoot, 'static'));
  writeFileSync(join(distRoot, 'static', 'app-abc123.js'), 'console.log("bundle");');

  prevEnv = process.env.CL_WEB_DIST;
  process.env.CL_WEB_DIST = distRoot;
  app = createApp();
});

afterAll(() => {
  if (prevEnv === undefined) delete process.env.CL_WEB_DIST;
  else process.env.CL_WEB_DIST = prevEnv;
  rmSync(distRoot, { recursive: true, force: true });
});

describe('resolveWebDistRoot', () => {
  it('returns the CL_WEB_DIST root when it contains index.html', () => {
    expect(resolveWebDistRoot()).toBe(distRoot);
  });

  it('returns null when neither CL_WEB_DIST nor a sibling web/dist exists', () => {
    delete process.env.CL_WEB_DIST;
    // In tests execPath is the bun binary — no web/dist sibling; unless the
    // dev machine happens to have one, this is null.
    if (process.execPath.endsWith('bun')) expect(resolveWebDistRoot()).toBeNull();
    process.env.CL_WEB_DIST = distRoot;
  });
});

describe('isApiPath', () => {
  it('matches exact prefixes and nested paths only', () => {
    expect(isApiPath('/v2')).toBe(true);
    expect(isApiPath('/v2/notebooks')).toBe(true);
    expect(isApiPath('/health/dependencies')).toBe(true);
    expect(isApiPath('/v2x')).toBe(false);
    expect(isApiPath('/research-lab/1')).toBe(false);
  });
});

describe('web static routes', () => {
  it('serves index.html at /', async () => {
    const res = await app.handle(new Request(`${BASE}/`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('crystalith-spa');
  });

  it('serves asset files with immutable caching', async () => {
    const res = await app.handle(new Request(`${BASE}/assets/app-abc123.js`));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('console.log("bundle");');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('treats Rsbuild static/ assets as immutable too', async () => {
    const res = await app.handle(new Request(`${BASE}/static/app-abc123.js`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('falls back to index.html for extension-less HTML navigations (SPA)', async () => {
    const res = await app.handle(
      new Request(`${BASE}/research-lab/7`, { headers: { Accept: 'text/html' } }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('crystalith-spa');
  });

  it('keeps JSON 404 for unknown API paths even with HTML accept', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/does-not-exist`, { headers: { Accept: 'text/html' } }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { errorCode?: string };
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('returns 404 (not index.html) for missing asset-like paths', async () => {
    const res = await app.handle(new Request(`${BASE}/assets/missing.js`));
    expect(res.status).toBe(404);
  });

  it('rejects path traversal outside the asset root', async () => {
    const res = await app.handle(new Request(`${BASE}/..%2f..%2fetc%2fpasswd`));
    expect(res.status).toBe(404);
  });

  it('rejects double-encoded traversal (no double decode)', async () => {
    const res = await app.handle(new Request(`${BASE}/%252e%252e%252f.env`));
    expect(res.status).toBe(404);
  });

  it('rejects windows drive-letter paths', async () => {
    const res = await app.handle(new Request(`${BASE}/C:/windows/win.ini`));
    expect(res.status).toBe(404);
  });

  it('never serves dotfiles, even inside the asset root', async () => {
    writeFileSync(join(distRoot, '.env'), 'SECRET=1');
    mkdirSync(join(distRoot, '.git'));
    writeFileSync(join(distRoot, '.git', 'config'), '[core]');

    const env = await app.handle(new Request(`${BASE}/.env`));
    expect(env.status).toBe(404);
    const dotSegment = await app.handle(new Request(`${BASE}/.git/config`));
    expect(dotSegment.status).toBe(404);
  });
});
