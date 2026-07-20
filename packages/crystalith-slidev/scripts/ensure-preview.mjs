#!/usr/bin/env bun
/**
 * Ensure Slidev has a markdown entry + resolvable node_modules next to it.
 *
 * Studio writes the single shared preview to `{data_root}/slides/preview/slides.md`
 * (see writeSlideFile in apps/server/src/features/studio/service.ts). Only one
 * preview is open at a time, so Slidev always serves that same path.
 *
 * Resolution order:
 *   1. SLIDEV_PREVIEW_PATH (absolute, or relative to repo root)
 *   2. CL_DATA_ROOT/slides/preview/slides.md (relative → repo root)
 *   3. {repoRoot}/data/slides/preview/slides.md
 *
 * Slidev resolves themes relative to the markdown file's directory, so we
 * symlink this package's node_modules into that preview dir.
 */
import fs from 'node:fs';
import { mkdir, writeFile, lstat, unlink, rm } from 'node:fs/promises';
import path from 'node:path';

const __dirname = import.meta.dirname;
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

function resolveAgainstRepo(p) {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
}

function defaultPreviewPath() {
  const dataRoot = process.env.CL_DATA_ROOT
    ? resolveAgainstRepo(process.env.CL_DATA_ROOT)
    : path.join(repoRoot, 'data');
  return path.join(dataRoot, 'slides', 'preview', 'slides.md');
}

const previewPath = process.env.SLIDEV_PREVIEW_PATH
  ? resolveAgainstRepo(process.env.SLIDEV_PREVIEW_PATH)
  : defaultPreviewPath();

const previewDir = path.dirname(previewPath);
const placeholder = `---
title: 演示预览
theme: default
---

# 演示预览

等待 Studio 生成 Markdown…
`;

await mkdir(previewDir, { recursive: true });
if (!fs.existsSync(previewPath)) {
  await writeFile(previewPath, placeholder, 'utf8');
}

async function resolveModulesRoot() {
  const candidates = [path.join(packageRoot, 'node_modules'), path.join(repoRoot, 'node_modules')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, '@slidev', 'cli'))) {
      return candidate;
    }
  }
  return null;
}

const sourceModules = await resolveModulesRoot();
const targetModules = path.join(previewDir, 'node_modules');

if (sourceModules) {
  let needsLink = true;
  if (fs.existsSync(targetModules)) {
    try {
      const st = await lstat(targetModules);
      if (st.isSymbolicLink()) {
        const current = fs.readlinkSync(targetModules);
        const resolved = path.resolve(previewDir, current);
        if (resolved === sourceModules || current === sourceModules) {
          needsLink = false;
        } else {
          await unlink(targetModules);
        }
      } else {
        await rm(targetModules, { recursive: true, force: true });
      }
    } catch {
      needsLink = true;
    }
  }
  if (needsLink) {
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    await fs.promises.symlink(sourceModules, targetModules, linkType);
  }
} else {
  console.warn(
    '[crystalith-slidev] @slidev/cli not found in node_modules; run `bun install` from repo root.',
  );
}

process.stdout.write(previewPath);
