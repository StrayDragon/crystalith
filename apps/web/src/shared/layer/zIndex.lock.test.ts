// covers: r339（web-ui-foundation）——静态锁：apps/web/src 内禁止新增硬编码 z-index（z-数字/z-[...] class 与 zIndex 数字字面量），层级一律经 Layer token；存量项显式白名单。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from '@rstest/core';

const webRoot = join(import.meta.dirname, '../../..');
const webSrc = join(webRoot, 'src');
const layerDir = join(webSrc, 'shared', 'layer');

function isTsFile(name: string): boolean {
  return /\.(ts|tsx)$/u.test(name);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    // Layer 系统自身定义层级 token，是唯一豁免目录
    if (entry.isDirectory()) return full === layerDir ? [] : walk(full);
    return isTsFile(entry.name) ? [full] : [];
  });
}

const Z_CLASS_PATTERN = /(?<!\w)z-\d+/gu;
const Z_ARBITRARY_PATTERN = /(?<!\w)z-\[[^\]]*\]/gu;
const Z_INDEX_LITERAL_PATTERN = /zIndex\s*:\s*['"]?\d/u;

/**
 * 存量白名单（与现状一致；新增硬编码 z-index 会以 diff 形式失败）。
 * 来源逐条注明：
 * - Layer 门户容器内部「backdrop z-0 + 内容 z-10」的局部相对层叠：容器定层已由
 *   useLayer(...) 注入 style.zIndex（Layer token），这两个 class 只表达同一 Layer
 *   内部的先后顺序，不越过 Layer 系统（CommandPalette/WidgetCatalog/WorkspaceTopbarSearch）。
 * - 普通文档流内的局部堆叠上下文（元素盖过兄弟节点，非弹层层级）：
 *   WorkspaceLayout 顶栏条、SlidesPreviewPanel iframe、LabReportCiteAside、
 *   LabReportPlateEditor 行内 UI、DemoResearchLabPage（demo 页）。
 * - ResearchLabPage 为注释文本提及历史类名（W5 迁移说明），非实际 class。
 */
const WHITELIST: Record<string, string[]> = {
  'features/workspace/layout/modular-canvas/CommandPalette.tsx': ['z-0', 'z-10'],
  'features/workspace/layout/modular-canvas/WidgetCatalog.tsx': ['z-0', 'z-10'],
  'features/workspace/layout/WorkspaceTopbarSearch.tsx': ['z-0', 'z-10'],
  'features/workspace/layout/WorkspaceLayout.tsx': ['z-10'],
  'features/workspace/domains/studio/slides-studio/components/SlidesPreviewPanel.tsx': ['z-10'],
  'features/research-lab/LabReportCiteAside.tsx': ['z-10'],
  'features/research-lab/LabReportPlateEditor.tsx': ['z-[1]', 'z-[1]'],
  'features/research-lab-demo/DemoResearchLabPage.tsx': ['z-10', 'z-10', 'z-10', 'z-30'],
  'features/research-lab/ResearchLabPage.tsx': ['z-10'],
};

function zTokens(text: string): string[] {
  return [
    ...(text.match(Z_CLASS_PATTERN) ?? []),
    ...(text.match(Z_ARBITRARY_PATTERN) ?? []),
  ].toSorted();
}

function scanZClasses(files: string[]): Record<string, string[]> {
  const hits: Record<string, string[]> = {};
  for (const file of files) {
    const tokens = zTokens(readFileSync(file, 'utf8'));
    if (tokens.length === 0) continue;
    hits[relative(webSrc, file).split(sep).join('/')] = tokens;
  }
  return hits;
}

describe('web-ui-z-index-lock', () => {
  it('has no numeric zIndex style literals (Layer tokens only)', () => {
    const files = walk(webSrc);
    const offenders = files.filter((file) =>
      Z_INDEX_LITERAL_PATTERN.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => relative(webSrc, file))).toEqual([]);
  });

  it('tailwind z-* classes stay exactly whitelisted', () => {
    const hits = scanZClasses(walk(webSrc));
    expect(hits).toEqual(WHITELIST);
  });
});
