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

const child = spawn(
  process.execPath,
  [bin, previewPath, '--port', String(port), '--open', 'false', '--theme', '@slidev/theme-default'],
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
