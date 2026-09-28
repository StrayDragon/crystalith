import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@rstest/core';

// covers: r158
// 负向静态扫描：wire 已是 camelCase，前端不得实现 snake_case→camelCase 字段重命名映射。
// 扫描器只匹配“重命名机制”（标识符 / 正则替换 / 第三方库），不匹配读到的 snake_case 字段名。

const ROOT = join(import.meta.dirname, '..');

const SCAN_PATTERN = new RegExp(
  [
    'snakeToCamel',
    'toCamelCase',
    'camelize',
    'decamelize',
    'replace\\(\\s*/_\\(\\[a-z\\]\\)/', // `.replace(/_([a-z])/g, …)` 首字母大写合并
    "from '(humps|camelcase|change-case|decamelize)'",
  ].join('|'),
  'i',
);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'vendor') continue;
      collectSourceFiles(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/u.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/u.test(entry)) continue;
    acc.push(full);
  }
  return acc;
}

test('scanner detects snake-to-camel rename machinery (positive control)', () => {
  const synthetic = 'const out = input.replace(/_([a-z])/g, (_, c) => c.toUpperCase());';
  expect(SCAN_PATTERN.test(synthetic)).toBe(true);
  expect(SCAN_PATTERN.test('const name = details.existing_filename;')).toBe(false);
});

test('web src contains no snake-to-camel payload normalization', () => {
  const offenders: string[] = [];
  for (const file of collectSourceFiles(ROOT)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (SCAN_PATTERN.test(line)) {
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  expect(offenders).toEqual([]);
});
