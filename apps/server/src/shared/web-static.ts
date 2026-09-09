import { existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

import { Elysia, NotFoundError } from 'elysia';

// Static web hosting for the single-binary distribution (ship-server-binary
// design D1 option B): the release archive ships `web/dist` beside the
// `crystalith-server` executable; when present the server mounts the built SPA
// on the same origin as the API, otherwise it stays pure API (headless mode).
//
// Route precedence: registered last, so every feature route (static or
// `:param`) wins over the `/*` catch-all; the handler re-throws NotFoundError
// for API prefixes so unmatched API paths keep the JSON ErrorEnvelope.

/** Path prefixes that must never fall back to the SPA index.html. */
export const API_PATH_PREFIXES = ['/v1', '/v2', '/health', '/openapi', '/asyncapi'] as const;

/**
 * Locate the web asset root: `CL_WEB_DIST` (explicit override, relative paths
 * resolve against CWD) first, then a `web/dist` sibling of the executable
 * (release archive layout). Returns null → API-only mode.
 */
export function resolveWebDistRoot(): string | null {
  const candidates = [process.env.CL_WEB_DIST, join(dirname(process.execPath), 'web', 'dist')];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const root = resolve(candidate);
    if (existsSync(join(root, 'index.html'))) return root;
  }
  return null;
}

function cacheControlFor(relPath: string): string {
  // Vite emits content-hashed filenames under assets/ — safe to cache forever.
  if (relPath.startsWith(`assets${sep}`) || relPath.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}

/** True when pathname is exactly a prefix or nested under it. */
export function isApiPath(pathname: string): boolean {
  return API_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Mount the SPA catch-all. Always registerable: with `root === null` every
 * request falls through to NotFoundError, matching the previous no-static
 * behavior, which keeps `App` (and thus Eden treaty types) deterministic.
 */
export function webStaticRoutes(root: string | null) {
  return new Elysia({ name: 'web-static' }).get('/*', async ({ request }) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      throw new NotFoundError();
    }
    if (isApiPath(pathname)) throw new NotFoundError();
    if (root === null) throw new NotFoundError();

    const relPath = pathname.replace(/^\/+/u, '');
    const filePath = resolve(root, relPath);
    // Traversal guard: the resolved path must stay inside the asset root.
    if (filePath !== root && !filePath.startsWith(root + sep)) throw new NotFoundError();

    // The root path always serves index.html regardless of Accept (curl/API
    // pings included); browsers navigating to / always send text/html anyway.
    if (relPath === '') {
      return new Response(Bun.file(join(root, 'index.html')), {
        headers: { 'cache-control': 'no-cache' },
      });
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath), {
        headers: { 'cache-control': cacheControlFor(relPath) },
      });
    }

    // SPA history fallback: extension-less HTML navigations get index.html.
    const lastSegment = relPath.split('/').at(-1) ?? '';
    const isFileLike = lastSegment !== '' && extname(lastSegment) !== '';
    const acceptsHtml = (request.headers.get('accept') ?? '').includes('text/html');
    if (isFileLike || !acceptsHtml) throw new NotFoundError();
    return new Response(Bun.file(join(root, 'index.html')), {
      headers: { 'cache-control': 'no-cache' },
    });
  });
}
