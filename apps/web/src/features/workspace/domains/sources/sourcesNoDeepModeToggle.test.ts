import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@rstest/core';

// covers: r442
// 负向静态扫描：工作区来源面板（sources/）MUST NOT 出现 Fast/Deep 深研模式切换、
// 深研队列主入口等旧深研模式残留文案（仿 noSnakeToCamel.test.ts 的负向扫描范式）。

const ROOT = join(import.meta.dirname);

const DEEP_MODE_RESIDUE = new RegExp(
  [
    'deep[\\s_-]*research', // "Deep Research" 模式名
    'Fast\\s*[/|]\\s*Deep', // "Fast/Deep" 切换对
    'Deep\\s*[/|]\\s*Fast', // "Deep/Fast" 切换对
    '深研模式',
    '深度模式',
    '深研队列',
  ].join('|'),
  'i',
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/u.test(entry)) continue;
    acc.push(full);
  }
  return acc;
}

test('scanner detects deep-mode toggle residue (positive control)', () => {
  expect(DEEP_MODE_RESIDUE.test("label: 'Deep Research'")).toBe(true);
  expect(DEEP_MODE_RESIDUE.test("mode === 'deep research'")).toBe(true);
  expect(DEEP_MODE_RESIDUE.test('Fast/Deep 模式切换')).toBe(true);
  expect(DEEP_MODE_RESIDUE.test('深研队列主入口')).toBe(true);
  // r261: 'Fast Research' 是网搜通道元数据（恒定 Fast），不是深研模式残留。
  expect(DEEP_MODE_RESIDUE.test("const mode = 'Fast Research';")).toBe(false);
});

test('sources panel contains no Fast/Deep deep-research mode residue', () => {
  const offenders: string[] = [];
  for (const file of collectSourceFiles(ROOT)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (DEEP_MODE_RESIDUE.test(line)) {
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  expect(offenders).toEqual([]);
});
