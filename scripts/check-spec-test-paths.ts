#!/usr/bin/env bun
/**
 * Spec 场景测试路径禁令（终态）—— llmanspec specs 的场景步骤 MUST NOT 引用测试文件。
 *
 * 背景：历史上 spec 场景以「当 运行 <测试路径> 的 X 用例」做绑定，属前向引用，
 * 测试改名/移动/删除即碎（2026-10 曾漂移 26 处）。迁移已完成（171 处引用清零，
 * 绑定改由代码侧 `// covers: rN` 反向锚点承载，见 llmanspec/AGENTS.md 书写守则）。
 * 本门禁现为「出现即拒」：spec 场景中出现任何 .test/.spec 文件引用即 fail。
 *
 * Usage: bun scripts/check-spec-test-paths.ts（just qa 内置）
 * Self-test: CHECK_SPECS_DIR=<临时目录> 指向含违规引用的副本验证负例。
 */
import { readdir, readFile } from 'node:fs/promises';
import { relative, join } from 'node:path';

const ROOT = import.meta.dir + '/..';
const SPECS_DIR = process.env.CHECK_SPECS_DIR ?? join(ROOT, 'llmanspec/specs');

const REF_RE = /\b[A-Za-z0-9_.\-/]+\.(?:test|spec)\.(?:ts|tsx)\b/gu;

async function listFeatures(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFeatures(p)));
    else if (e.name.endsWith('.feature')) out.push(p);
  }
  return out;
}

const violations: Array<{ feature: string; line: number; ref: string }> = [];
for (const f of await listFeatures(SPECS_DIR)) {
  const lines = (await readFile(f, 'utf8')).split('\n');
  lines.forEach((text, i) => {
    for (const m of text.matchAll(REF_RE)) {
      violations.push({ feature: relative(ROOT, f), line: i + 1, ref: m[0] });
    }
  });
}

if (violations.length > 0) {
  console.error(
    `[check-spec-test-paths] FAIL — spec 场景出现 ${violations.length} 处测试文件引用（守则：场景=产品桥梁，绑定走代码侧 covers:rN）:`,
  );
  for (const v of violations) {
    console.error(`  - ${v.ref}  (${v.feature}:${v.line})`);
  }
  process.exit(1);
}
console.log('[check-spec-test-paths] OK — spec 场景 0 处测试文件引用（终态禁令）');
