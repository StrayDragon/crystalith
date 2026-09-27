#!/usr/bin/env bun
/**
 * req id collision check — flags @req:<id> handles reused across multiple rule
 * headers within the same .feature file under llmanspec/specs.
 *
 * Why: @req is the unique key of the llman-sdd 0.5 handle system (resolve-req,
 * review/lock reports, archived references). llman-sdd 0.5.0's validate
 * "global duplicate req_id" gate and `project dedupe-req-ids` both miss
 * within-file collisions, so this local guard runs until the upstream fix
 * lands (c112).
 *
 * Usage:
 *   bun scripts/check-req-id-collisions.ts   # exit 1 on any collision
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SPEC_DIRS = join(import.meta.dirname, '..', 'llmanspec', 'specs');

function collectFeatures(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectFeatures(full));
    else if (entry.endsWith('.feature')) results.push(full);
  }
  return results.toSorted();
}

type Collision = { file: string; tag: string; lines: number[] };

const collisions: Collision[] = [];
for (const file of collectFeatures(SPEC_DIRS)) {
  const lineNumbers = new Map<string, number[]>();
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, idx) => {
      const m = line.match(/^\s*@req:(r\d+)/u);
      if (m) lineNumbers.set(m[1], [...(lineNumbers.get(m[1]) ?? []), idx + 1]);
    });
  for (const [tag, lines] of lineNumbers) {
    if (lines.length > 1) collisions.push({ file, tag, lines });
  }
}

if (collisions.length > 0) {
  console.error(`[check-req-ids] ${collisions.length} colliding @req tag(s):`);
  for (const { file, tag, lines } of collisions) {
    console.error(`  ${tag} on rule-header lines ${lines.join(', ')} in ${file}`);
  }
  process.exit(1);
}
console.log('[check-req-ids] OK — no within-file @req id collisions.');
