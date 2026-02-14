import fs from 'node:fs';
import { mkdir, readlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const packageRoot = path.resolve(__dirname, '..');

const defaultPreviewPath = path.join(repoRoot, 'data', 'output', 'preview', 'slides.md');
const previewPath = process.env.SLIDEV_PREVIEW_PATH
  ? path.resolve(repoRoot, process.env.SLIDEV_PREVIEW_PATH)
  : defaultPreviewPath;

const previewDir = path.dirname(previewPath);
const placeholder = `---\ntitle: 演示预览\n---\n\n# 演示预览\n\n等待生成 Markdown...\n`;

await mkdir(previewDir, { recursive: true });
if (!fs.existsSync(previewPath)) {
  await writeFile(previewPath, placeholder, 'utf8');
}

const sourceModules = path.join(packageRoot, 'node_modules');
const targetModules = path.join(previewDir, 'node_modules');

function normalizePath(value) {
  return path.resolve(String(value));
}

async function ensurePreviewNodeModulesSymlink() {
  if (!fs.existsSync(sourceModules)) {
    return;
  }

  const linkType = process.platform === 'win32' ? 'junction' : 'dir';

  try {
    const stats = await fs.promises.lstat(targetModules);

    if (stats.isSymbolicLink()) {
      const currentTarget = await readlink(targetModules);
      const resolvedTarget = normalizePath(path.resolve(previewDir, currentTarget));
      const resolvedSource = normalizePath(sourceModules);
      if (resolvedTarget === resolvedSource) {
        return;
      }

      await unlink(targetModules);
      await fs.promises.symlink(sourceModules, targetModules, linkType);
      return;
    }

    // If it's a real directory/file, don't clobber it.
    return;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      await fs.promises.symlink(sourceModules, targetModules, linkType);
      return;
    }
    throw error;
  }
}

await ensurePreviewNodeModulesSymlink();
