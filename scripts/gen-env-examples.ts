// @crystalith/gen-env-examples
// Regenerate .env.example and config/secret.env.example from the Zod SSOT.
//
// Usage:
//   bun scripts/gen-env-examples.ts           # generate files
//   bun scripts/gen-env-examples.ts --check   # check for drift (exit 1 if different)
//
// The SSOT is defined in packages/shared/src/schemas/env.ts.
// NEVER edit .example files manually — edit the schema and regenerate.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  EnvTarget,
  type EnvEntryDescriptor,
  getAllEnvDescriptors,
} from '../packages/shared/src/schemas/env.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.cwd();

const BUILD_RUN_FILE = join(ROOT, '.env.example');
const SECRETS_FILE = join(ROOT, 'config', 'secret.env.example');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function generateBuildRunExample(descriptors: EnvEntryDescriptor[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# ============================================================================');
  lines.push('# Crystalith v2 Environment Configuration');
  lines.push('#');
  lines.push('# Auto-generated from packages/shared/src/schemas/env.ts.');
  lines.push('# DO NOT EDIT MANUALLY — edit the schema and run `just gen-env-examples`.');
  lines.push('# ============================================================================');
  lines.push('#');
  lines.push('# Quick start:  cp .env.example .env && just upsert-env-configs');
  lines.push('# Then:         just dev   # overmind: server :8032 + web :3000 + slidev :3030');
  lines.push('# Requires:     overmind + tmux on PATH');
  lines.push('# ============================================================================');
  lines.push('#');
  lines.push('# Runtime/business config lives in `config/app.yaml` (and `config/secret.env`).');
  lines.push('# This file controls build/run parameters.');
  lines.push('# ============================================================================');
  lines.push('');

  // Group: active
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('# Active configuration');
  lines.push('# ----------------------------------------------------------------------------');
  lines.push('');

  for (const desc of descriptors) {
    if (desc.deprecated) {
      continue;
    }
    if (desc.description) {
      lines.push(`# ${desc.description}`);
    }
    lines.push(`# ${desc.key}=`);
    lines.push('');
  }

  // Group: deprecated
  const deprecatedDescs = descriptors.filter((d) => d.deprecated);
  if (deprecatedDescs.length > 0) {
    lines.push('# ----------------------------------------------------------------------------');
    lines.push('# Deprecated — backward compatibility only');
    lines.push('# ----------------------------------------------------------------------------');
    lines.push('# These env vars are kept for v1 backward compatibility.');
    lines.push('# New code MUST use CL_* variants where available.');
    lines.push('');

    for (const desc of deprecatedDescs) {
      if (desc.description) {
        lines.push(`# ${desc.description}`);
      }
      lines.push(`# ${desc.key}=`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateSecretsExample(descriptors: EnvEntryDescriptor[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# Crystalith v2 secrets (dotenv format)');
  lines.push('# Copy to config/secret.env and fill in values.');
  lines.push('# This file is gitignored. Do NOT commit.');
  lines.push('#');
  lines.push('# Auto-generated from packages/shared/src/schemas/env.ts.');
  lines.push('# DO NOT EDIT MANUALLY — edit the schema and run `just gen-env-examples`.');
  lines.push('#');
  lines.push('# NOTE: The recommended way is to set CL_CHAT_API_KEY and');
  lines.push('# CL_EMBEDDING_API_KEY via environment variables (~/.bashrc),');
  lines.push('# not via this secrets file.');
  lines.push('#');
  lines.push('# Regenerate hints:');
  lines.push('#   just gen-env-examples');
  lines.push('');

  for (const desc of descriptors) {
    if (desc.description) {
      lines.push(`# ${desc.description}`);
    }
    lines.push(`${desc.key}=`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const isCheck = process.argv.includes('--check');
  const allDescs = getAllEnvDescriptors();

  const buildRunDescs = allDescs.filter((d) => d.target === EnvTarget.BuildRun);
  const secretsDescs = allDescs.filter((d) => d.target === EnvTarget.Secrets);

  const buildRunContent = generateBuildRunExample(buildRunDescs);
  const secretsContent = generateSecretsExample(secretsDescs);

  if (isCheck) {
    // Generate to tempdir and diff
    const tmpDir = join(tmpdir(), 'crystalith-gen-env-check');
    mkdirSync(tmpDir, { recursive: true });

    const tmpBuildRun = join(tmpDir, '.env.example');
    const tmpSecrets = join(tmpDir, 'secret.env.example');
    writeFileSync(tmpBuildRun, buildRunContent, 'utf-8');
    writeFileSync(tmpSecrets, secretsContent, 'utf-8');

    let hasDiff = false;

    // Check .env.example
    if (existsSync(BUILD_RUN_FILE)) {
      const existing = readFileSync(BUILD_RUN_FILE, 'utf-8');
      if (existing !== buildRunContent) {
        console.error(
          '[check] .env.example differs from SSOT — run `just gen-env-examples` to regenerate',
        );
        hasDiff = true;
      } else {
        console.log('[check] .env.example is up to date.');
      }
    } else {
      console.error('[check] .env.example is MISSING — run `just gen-env-examples` to create it');
      hasDiff = true;
    }

    // Check secret.env.example
    if (existsSync(SECRETS_FILE)) {
      const existing = readFileSync(SECRETS_FILE, 'utf-8');
      if (existing !== secretsContent) {
        console.error(
          '[check] config/secret.env.example differs from SSOT — run `just gen-env-examples` to regenerate',
        );
        hasDiff = true;
      } else {
        console.log('[check] config/secret.env.example is up to date.');
      }
    } else {
      console.error(
        '[check] config/secret.env.example is MISSING — run `just gen-env-examples` to create it',
      );
      hasDiff = true;
    }

    process.exit(hasDiff ? 1 : 0);
  }

  // Write files
  mkdirSync(dirname(BUILD_RUN_FILE), { recursive: true });
  writeFileSync(BUILD_RUN_FILE, buildRunContent, 'utf-8');
  console.log(`[gen] Wrote ${BUILD_RUN_FILE}`);

  mkdirSync(dirname(SECRETS_FILE), { recursive: true });
  writeFileSync(SECRETS_FILE, secretsContent, 'utf-8');
  console.log(`[gen] Wrote ${SECRETS_FILE}`);
}

main();
