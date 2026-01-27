import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
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
if (fs.existsSync(sourceModules) && !fs.existsSync(targetModules)) {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.promises.symlink(sourceModules, targetModules, linkType);
}
