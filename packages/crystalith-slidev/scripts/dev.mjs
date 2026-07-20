#!/usr/bin/env bun
import { spawn } from 'node:child_process';
/**
 * Start Slidev against the studio preview markdown (port 3030 by default).
 * Does not open a browser — Overmind / Studio iframe consume the URL.
 */
import fs from 'node:fs';
import path from 'node:path';

const __dirname = import.meta.dirname;
const packageRoot = path.resolve(__dirname, '..');

const ensure = spawn('bun', [path.join(__dirname, 'ensure-preview.mjs')], {
  cwd: packageRoot,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: process.env,
});

const chunks = [];
for await (const chunk of ensure.stdout) {
  chunks.push(chunk);
}
const code = await new Promise((resolve) => {
  ensure.on('close', resolve);
});
if (code !== 0) {
  process.exit(code ?? 1);
}

const previewPath = Buffer.concat(chunks).toString('utf8').trim();
const port = process.env.CL_SLIDEV_PORT || process.env.SLIDEV_PORT || '3030';

const slidevBin = path.join(packageRoot, 'node_modules', '@slidev', 'cli', 'bin', 'slidev.mjs');
const rootSlidev = path.join(
  packageRoot,
  '..',
  '..',
  'node_modules',
  '@slidev',
  'cli',
  'bin',
  'slidev.mjs',
);

const bin = fs.existsSync(slidevBin) ? slidevBin : rootSlidev;
if (!fs.existsSync(bin)) {
  console.error('[crystalith-slidev] slidev CLI missing; run `bun install` from repo root.');
  process.exit(1);
}

// Slidev 52 defaults host to "localhost" (often [::1] only). Passing
// --remote unlocks --bind; use empty password so it does NOT call
// public-ip (that lookup times out offline and kills the process).
// --base /slidev/ matches the same-origin iframe path used by Studio.
// Do NOT pass --theme here: CLI theme must match slides.md frontmatter
// (`theme: default`) or every markdown write triggers a full server restart
// and the Vite /slidev proxy returns 500 during that window.
const child = spawn(
  process.execPath,
  [
    bin,
    previewPath,
    '--port',
    String(port),
    '--remote',
    '',
    '--bind',
    '0.0.0.0',
    '--base',
    '/slidev/',
  ],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (exitCode, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(exitCode ?? 1);
});
