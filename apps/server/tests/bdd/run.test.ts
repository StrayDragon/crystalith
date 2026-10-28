// BDD entry point — auto-scans all .feature files and runs them.
//
// Importing this module (via `bun test tests/bdd/run.test.ts`) registers the
// common step definitions (side effect), then walks the features/ directory
// and turns every feature into a bun:test describe block. No per-domain
// binding files are needed (unlike v1's test_*.py @scenario stubs).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import './steps/common.ts';
import { makeContext } from './fixtures/server.ts';
import { runFeature } from './runner.ts';

const FEATURES_DIR = join(import.meta.dirname, 'features');

// Only feature files whose v2 router is at parity with the v1 contract run
// for real; the skip set below keeps non-parity domains out.
//
// Pruned (test cleanup): commands / models / outputs / qa / source_connectors /
// studio were v1-contract ports kept permanently skipped since the v2 port and
// were removed together with their skip entries; research / templates dirs were
// already gone. Do not re-add feature files without runnable routes (see c73
// note below).
//
// Deleted (c73 dead HTTP — feature files removed, do not re-add without routes):
//   citations (/citations/context), refine (/v2/refine*), tasks (/v2/tasks*)
const SKIP_FEATURE_DIRS = new Set<string>([]);

function collectFeatures(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFeatures(full));
    } else if (entry.endsWith('.feature')) {
      results.push(full);
    }
  }
  return results.sort();
}

for (const featurePath of collectFeatures(FEATURES_DIR)) {
  // Skip by feature directory (e.g. features/qa/...). The immediate child dir
  // of features/ is the domain; if it's in SKIP_FEATURE_DIRS the whole file is
  // excluded rather than registered as skipped scenarios. This keeps the test
  // output focused on the implemented CRUD surface.
  const rel = featurePath.slice(FEATURES_DIR.length + 1);
  const domainDir = rel.split('/')[0];
  if (SKIP_FEATURE_DIRS.has(domainDir)) continue;

  runFeature(featurePath, makeContext);
}
