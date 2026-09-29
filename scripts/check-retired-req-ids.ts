// Guard against req-id reuse of retired ids (docs/specs-bare-rule-campaign.md
// 「req id 退役护栏」): `spec next-req-id` allocates the smallest free number,
// so deleting a capability releases its ids for reuse — colliding with
// historical references in archived changes. This check fails if any live
// spec uses a retired id, or if a new allocation would hand out one.
//
// Upstream tracking: llman-sdd#5 (next-req-id smallest-free semantics).
// Retire this guard if upstream ships max+1 allocation or tombstones.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SPECS_DIR = join(ROOT, 'llmanspec', 'specs');

/** Retired ids by deletion batch (see campaign map). Extend when capabilities are removed. */
const RETIRED: Array<{ range: [number, number]; reason: string }> = [
  { range: [39, 44], reason: 'c121 removed cross-type-result-transformations (r45 migrated)' },
  { range: [50, 50], reason: 'c122 removed data-and-storage r50 (c14 architecture supersedes)' },
  { range: [239, 244], reason: 'c121 removed source-aware-generation-modes' },
  { range: [419, 419], reason: 'c121 removed source-aware-generation-modes' },
];

const isRetired = (n: number): string | null => {
  for (const { range, reason } of RETIRED) {
    if (n >= range[0] && n <= range[1]) return reason;
  }
  return null;
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.feature')) out.push(full);
  }
  return out;
}

const offenders: string[] = [];
let maxId = 0;
for (const file of walk(SPECS_DIR)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/@req:r(\d+)/gu)) {
    const n = Number(match[1]);
    maxId = Math.max(maxId, n);
    const reason = isRetired(n);
    if (reason) offenders.push(`${file}: @req:r${n} — ${reason}`);
  }
}

if (offenders.length > 0) {
  console.error('[check-retired-req-ids] retired ids re-entered live specs:');
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}

if (maxId < 474) {
  console.error(
    `[check-retired-req-ids] unexpected max req id r${maxId} (< r474); ` +
      'did specs lose newer rules? See docs/specs-bare-rule-campaign.md.',
  );
  process.exit(1);
}

console.log(`[check-retired-req-ids] OK — no retired id in use, max req id r${maxId}`);
