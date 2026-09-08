// Assemble the release archive for the current platform
// (ship-server-binary / c13 v1 — resource-beside-binary layout, design D1-B):
//
//   crystalith-server-<version>-<os>-<arch>.tar.gz
//     ├── crystalith-server   single-binary API + static web host
//     ├── web/dist/           SPA build, served when present (CL_WEB_DIST / sibling)
//     ├── drizzle/            SQL migrations, applied at startup
//     ├── native/             sqlite-vec platform extension (loaded at startup)
//     └── config/             app.yaml runtime config (never secret.env)
//
// Version source: the release git tag on HEAD (`v*`, design D2); without a
// tag, the workspace package version is used. Outputs land in
// `target/release/`. Cross-platform matrix builds are left to CI — this
// script always targets the host platform.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outDir = path.join(repoRoot, 'target', 'release');

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

async function sh(cmd: string[], opts: { cwd?: string } = {}): Promise<void> {
  const proc = Bun.spawnSync(cmd, {
    cwd: opts.cwd ?? repoRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (proc.exitCode !== 0) {
    throw new Error(`command failed (${proc.exitCode}): ${cmd.join(' ')}`);
  }
}

const version = detectVersion();
// Platform triple for the archive name: linux | darwin | win32 + x64 | arm64.
const os = process.platform === 'win32' ? 'win32' : process.platform;
const arch = process.arch;
const name = `crystalith-server-${version}-${os}-${arch}`;
const stageDir = path.join(outDir, 'stage', name);

console.log(`📦 building release ${name} …`);

// 1. Web SPA build (vite → apps/web/dist).
await sh(['bun', 'run', 'build'], { cwd: path.join(repoRoot, 'apps', 'web') });
const webDist = path.join(repoRoot, 'apps', 'web', 'dist');
if (!existsSync(path.join(webDist, 'index.html'))) {
  throw new Error('apps/web/dist/index.html missing after web build');
}

// 2. Server single binary (includes version injection + bundling workarounds).
await sh(['bun', 'scripts/build-binary.ts'], { cwd: path.join(repoRoot, 'apps', 'server') });
// bun compile appends .exe on win32 hosts — accept both layouts.
const builtBinary =
  [
    path.join(repoRoot, 'apps', 'server', 'crystalith-server'),
    path.join(repoRoot, 'apps', 'server', 'crystalith-server.exe'),
  ].find((p) => existsSync(p)) ??
  (() => {
    throw new Error('server binary missing after build');
  })();
const binaryName = os === 'win32' ? 'crystalith-server.exe' : 'crystalith-server';

// 3. Stage the archive layout.
rmSync(path.join(outDir, 'stage'), { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync(builtBinary, path.join(stageDir, binaryName));
cpSync(webDist, path.join(stageDir, 'web', 'dist'), { recursive: true });
cpSync(path.join(repoRoot, 'apps', 'server', 'drizzle'), path.join(stageDir, 'drizzle'), {
  recursive: true,
});
// Runtime config — copied explicitly so a local config/secret.env never leaks.
const configDir = path.join(stageDir, 'config');
mkdirSync(configDir);
for (const f of ['app.yaml', 'app.schema.gen.json']) {
  cpSync(path.join(repoRoot, 'config', f), path.join(configDir, f));
}

// sqlite-vec native extension — the compiled binary cannot resolve the
// platform package from Bun's virtual FS, so ship the entry file beside the
// binary under native/ (loaded via the db/index.ts fallback).
const vecExt = os === 'win32' ? 'dll' : os === 'darwin' ? 'dylib' : 'so';
const vecPkgOs = os === 'win32' ? 'windows' : os;
const vecRel = `sqlite-vec-${vecPkgOs}-${arch}/vec0.${vecExt}`;
function findSqliteVecEntry(): string {
  // bun installs platform packages into the content-addressable .bun store;
  // npm/yarn hoist them flat — try both layouts.
  for (const pattern of [
    `node_modules/.bun/${vecRel.split('/')[0]}@*/node_modules/${vecRel}`,
    `node_modules/${vecRel}`,
  ]) {
    for (const hit of new Bun.Glob(pattern).scanSync({ cwd: repoRoot, onlyFiles: true })) {
      return path.join(repoRoot, hit);
    }
  }
  throw new Error(`sqlite-vec platform entry not found (looked for ${vecRel})`);
}
mkdirSync(path.join(stageDir, 'native'));
const stagedVec = path.join(stageDir, 'native', `vec0.${vecExt}`);
cpSync(findSqliteVecEntry(), stagedVec);
if (os === 'darwin') {
  // arm64 macOS refuses unsigned dylibs at dlopen time — ad-hoc re-sign the
  // shipped extension and strip any quarantine xattr (best-effort).
  const codesign = Bun.which('codesign');
  if (codesign) {
    const proc = Bun.spawnSync([codesign, '--force', '--sign', '-', stagedVec], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
    if (proc.exitCode !== 0) console.warn('⚠️ codesign failed — dylib may not load');
  }
  Bun.spawnSync(['xattr', '-cr', stagedVec]);
}

// 4. Pack + checksum (Bun-native hashing — sha256sum is not on Windows PATH).
await sh(['tar', '-czf', path.join(outDir, `${name}.tar.gz`), name], {
  cwd: path.join(outDir, 'stage'),
});
const hasher = new Bun.CryptoHasher('sha256');
hasher.update(await Bun.file(path.join(outDir, `${name}.tar.gz`)).arrayBuffer());
const digest = hasher.digest('hex');
await Bun.write(path.join(outDir, `${name}.tar.gz.sha256`), `${digest}  ${name}.tar.gz\n`);

console.log(`✅ target/release/${name}.tar.gz (sha256 ${digest.slice(0, 12)}…)`);
