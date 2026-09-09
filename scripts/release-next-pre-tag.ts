#!/usr/bin/env bun
// Compute the next `v<base>-pre.N` tag from existing git tags and create it
// at HEAD — the counter behind `just release-next-pre`.
//
// SemVer pre-release identifiers sort correctly out of the box
// (2.0.0-pre.1 < 2.0.0-pre.2 < 2.0.0-rc.1 < 2.0.0), and the Release workflow
// treats any dashed tag as a prerelease, so iterating pre-releases is just
// "bump N, push, let CI build". Tags are never moved or deleted here.
//
// Usage:
//   bun scripts/next-pre-tag.ts             # auto-detect base from the latest v*-pre* tag
//   bun scripts/next-pre-tag.ts 2.0.0      # explicit base ('v' prefix optional)
//   bun scripts/next-pre-tag.ts --dry-run  # print the tag without creating it
//
// The script creates the tag locally only — pushing it triggers the Release
// workflow, so that stays an explicit `git push origin <tag>`.

const PRE_TAG_RE = /^v(\d+)\.(\d+)\.(\d+)-pre(?:\.(\d+))?$/;

function sh(cmd: string[], options?: { allowFailure?: boolean }): string {
  const proc = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const out = proc.stdout.toString().trim();
  if (proc.exitCode !== 0 && !options?.allowFailure) {
    const err = proc.stderr.toString().trim();
    console.error(
      `[next-pre-tag] \`${cmd.join(' ')}\` failed (exit ${proc.exitCode})${err ? `: ${err}` : ''}`,
    );
    process.exit(1);
  }
  return out;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseArg = args.find((a) => a !== '--dry-run')?.replace(/^v/, '');
if (baseArg !== undefined && !/^\d+\.\d+\.\d+$/.test(baseArg)) {
  console.error(`[next-pre-tag] invalid base version "${baseArg}" — expected X.Y.Z`);
  process.exit(1);
}

// See tags pushed from elsewhere so we never collide with a remote-only tag.
// Offline is fine — warn and continue with local knowledge only.
const fetchProc = Bun.spawnSync(['git', 'fetch', '--tags', '--quiet'], {
  stdout: 'pipe',
  stderr: 'pipe',
});
if (fetchProc.exitCode !== 0) {
  console.warn('[next-pre-tag] git fetch --tags failed — continuing with local tags only');
}

const localTags = sh(['git', 'tag', '-l']).split('\n').filter(Boolean);

interface PreTag {
  base: string;
  maj: number;
  min: number;
  pat: number;
  n: number; // pre-release counter; plain `-pre` counts as 0
}

const preTags: PreTag[] = [];
for (const tag of localTags) {
  const m = PRE_TAG_RE.exec(tag);
  if (!m) continue;
  preTags.push({
    base: `${m[1]}.${m[2]}.${m[3]}`,
    maj: Number(m[1]),
    min: Number(m[2]),
    pat: Number(m[3]),
    n: m[4] === undefined ? 0 : Number(m[4]),
  });
}

// Resolve the base series: explicit arg wins; otherwise the highest
// X.Y.Z that already has a -pre tag. No pre tags at all → ask for one.
let base: string;
if (baseArg !== undefined) {
  base = baseArg;
} else {
  const highest = preTags
    .toSorted((a, b) => a.maj - b.maj || a.min - b.min || a.pat - b.pat)
    .at(-1);
  if (!highest) {
    console.error(
      '[next-pre-tag] no existing v*-pre* tags to derive a base from — pass one explicitly, e.g. `just next-pre 2.0.0`',
    );
    process.exit(1);
  }
  base = highest.base;
}

// Plain `-pre` counts as 0, so a fresh series (or one at `-pre`) starts at .1.
const maxN = Math.max(0, ...preTags.filter((t) => t.base === base).map((t) => t.n));
const tag = `v${base}-pre.${maxN + 1}`;

if (localTags.includes(tag)) {
  // Unreachable via max+1 when tags are well-formed; a corrupt/duplicate tag
  // would land here — refuse rather than produce a confusing git error.
  console.error(`[next-pre-tag] tag ${tag} already exists — refusing to move it`);
  process.exit(1);
}

if (dryRun) {
  console.log(tag);
  process.exit(0);
}

sh(['git', 'tag', tag, 'HEAD']);
console.log(`✅ created ${tag} at HEAD (${sh(['git', 'rev-parse', '--short', 'HEAD'])})`);
console.log(`   Review:  git show ${tag}`);
console.log(`   Release: git push origin ${tag}   # triggers the Release workflow`);
