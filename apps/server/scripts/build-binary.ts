// Single-binary build (ship-server-binary / c13 v1): compiles `src/server.ts`
// into `./crystalith-server` via the Bun.build API.
//
// Why not the plain CLI (`bun build --compile`)? The CLI fails to inline
// css-tree's top-level `require('../data/patch.json')` (reached via jsdom →
// @asamuzakjp/dom-selector → css-tree), so the compiled binary aborted on boot
// with "Cannot find module '../data/patch.json'". The plugin below inlines the
// JSON as a literal; see docs/known-issues.md.
//
// Version injection (design D2): the release git tag is the version authority;
// without a tag on HEAD the workspace package version is used.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const pkgRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(pkgRoot, '..', '..');

function detectVersion(): string {
  const proc = Bun.spawnSync(['git', 'describe', '--tags', '--exact-match'], { cwd: repoRoot });
  if (proc.exitCode === 0) {
    const tag = proc.stdout.toString().trim();
    if (tag) return tag.replace(/^v/u, '');
  }
  return (
    JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
  ).version;
}

/**
 * Inline string-literal `require('<…>.json')` calls inside css-tree's lib/cjs
 * files (see file header). css-tree reaches JSON via runtime requires —
 * `createRequire(import.meta.url)('mdn-data/css/…')` in lib/data.js and plain
 * `require('../data/patch.json')` in lib/data-patch.js — which Bun's compiled
 * output does not embed. Specifiers are resolved relative to the requiring
 * file (Bun.resolveSync handles both relative and bare package specifiers).
 */
const inlineCssTreeJsonRequires: import('bun').BunPlugin = {
  name: 'inline-css-tree-json-requires',
  setup(build) {
    build.onLoad(
      { filter: /[\\/]css-tree[\\/](lib|cjs)[\\/][^\\/]+\.(js|cjs)$/u },
      async (args) => {
        const source = await Bun.file(args.path).text();
        const dir = path.dirname(args.path);
        const contents = source.replaceAll(
          /require\((['"])([^'"]+\.json)\1\)/gu,
          (match: string, _quote: string, spec: string) => {
            try {
              const resolved = Bun.resolveSync(spec, dir);
              return `(${readFileSync(resolved, 'utf8')})`;
            } catch {
              // Unresolvable → leave for the bundler/runtime to surface.
              return match;
            }
          },
        );
        return { contents, loader: 'js' };
      },
    );
  },
};

const result = await Bun.build({
  entrypoints: [path.join(pkgRoot, 'src', 'server.ts')],
  target: 'bun',
  // `compile` exists at runtime in Bun 1.4 but is missing from bun-types.
  compile: { outfile: path.join(pkgRoot, 'crystalith-server') } as never,
  define: {
    'process.env.CL_BUILD_VERSION': JSON.stringify(detectVersion()),
  },
  plugins: [inlineCssTreeJsonRequires],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
console.log(`✅ crystalith-server compiled (version ${detectVersion()})`);
