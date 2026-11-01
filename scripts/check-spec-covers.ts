#!/usr/bin/env bun
import { existsSync, type Dirent } from 'node:fs';
/**
 * Spec↔test 覆盖门禁：每个「有场景」的 @req:rN 必须有代码侧 `// covers: rN` 锚，
 * 或在豁免登记 llmanspec/spec-coverage-exemptions.json 中带原因登记。
 *
 * - 锚扫描取整行 covers: 注释（斜杠 rN 列表全解析），覆盖 apps/packages/e2e 全部 .ts/.tsx
 *   （含 bdd/runner.ts 等非 *.test 文件）。
 * - 语义交叉检查（最小 lint）：规格文本中的特征 token（反引号代码片段、UPPER_SNAKE
 *   错误码）必须出现在至少一个锚文件内容里。锚存在但内容与场景毫无交集（错锚，
 *   如 r266 曾锚在 malformed-JSON 测试上）在此暴露。特征 token 提取刻意保守：
 *   反引号字面量 + 含下划线的全大写词，RFC2119 关键词（MUST/SHALL 等无下划线）不命中。
 * - 豁免登记同时被校验：已锚的 rN 不得滞留登记（防债台隐形）；登记必须含 reason/seam。
 *
 * Usage: bun scripts/check-spec-covers.ts（just qa 内置）
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = import.meta.dir + '/..';
const SPECS_DIR = join(ROOT, 'llmanspec/specs');
const EXEMPT_PATH = join(ROOT, 'llmanspec/spec-coverage-exemptions.json');
const SCAN_ROOTS = ['apps', 'packages', 'e2e'].map((d) => join(ROOT, d));

interface ReqInfo {
  capability: string;
  scenario: boolean;
  /** @req 块内的规格原文（规则 + 场景），供特征 token 提取。 */
  text: string[];
}

const reqs = new Map<string, ReqInfo>();
for (const f of await listFeatures(SPECS_DIR)) {
  let cur: string | null = null;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = /^\s*@req:(r\d+)/u.exec(line);
    if (m) {
      cur = m[1]!;
      const capability = f.split('/').pop()!.replace('.feature', '')!;
      reqs.set(cur, { capability, scenario: false, text: [line] });
    } else if (cur) {
      if (/^\s*场景:/u.test(line)) reqs.get(cur)!.scenario = true;
      reqs.get(cur)!.text.push(line);
    }
  }
}

async function listFeatures(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFeatures(p)));
    else if (e.name.endsWith('.feature')) out.push(p);
  }
  return out;
}

/** rN → 锚文件相对路径集合。 */
const anchorFiles = new Map<string, Set<string>>();
/** 相对路径 → 文件内容（供 token 交叉检查）。 */
const fileContents = new Map<string, string>();

/** 旁路：依赖目录与构建产物不进锚扫描。 */
function isSkippedDir(name: string): boolean {
  return name === 'node_modules' || name === 'dist' || name === '.tmp';
}

function isTsFile(name: string): boolean {
  return /\.(ts|tsx)$/u.test(name);
}

async function listDirSafe(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** 从一行文本提取 covers rN（非 covers 行返回空）。 */
function anchorIds(line: string): string[] {
  if (!/^\s*\/\/ covers:/u.test(line)) return [];
  return [...line.matchAll(/r\d+/gu)].map((m) => m[0]);
}

async function scanFileAnchors(path: string): Promise<void> {
  const content = await readFile(path, 'utf8');
  const rel = relative(ROOT, path);
  fileContents.set(rel, content);
  for (const line of content.split('\n')) {
    for (const id of anchorIds(line)) {
      const files = anchorFiles.get(id) ?? new Set<string>();
      files.add(rel);
      anchorFiles.set(id, files);
    }
  }
}

async function handleEntry(path: string, e: Dirent): Promise<void> {
  if (!e.isDirectory()) {
    if (isTsFile(e.name)) await scanFileAnchors(path);
    return;
  }
  await collectAnchors(path);
}

async function collectAnchors(dir: string): Promise<void> {
  const entries = (await listDirSafe(dir)).filter((x) => !isSkippedDir(x.name));
  for (const e of entries) await handleEntry(join(dir, e.name), e);
}

for (const root of SCAN_ROOTS) await collectAnchors(root);

/** 规格文本里的反引号字面量（≥3 字符且含字母/数字才有检索辨识度）。 */
function backtickTokens(text: string, tokens: Set<string>): void {
  for (const m of text.matchAll(/`([^`\n]+)`/gu)) {
    const t = m[1]!.trim();
    if (t.length >= 3 && /[A-Za-z0-9_]/u.test(t)) tokens.add(t);
  }
}

/** 规格文本里的 UPPER_SNAKE 词（错误码类；MUST/SHALL 等无下划线通用词不命中）。 */
function upperSnakeTokens(text: string, tokens: Set<string>): void {
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/gu)) {
    tokens.add(m[0]);
  }
}

/**
 * 规格文本的特征 token：反引号字面量 + 含下划线的全大写词（错误码类）。
 * 刻意保守——只收有足够辨识度的形态，避免把通用词变成噪声。
 */
function distinctiveTokens(lines: string[]): string[] {
  const text = lines.join('\n');
  const tokens = new Set<string>();
  backtickTokens(text, tokens);
  upperSnakeTokens(text, tokens);
  return [...tokens];
}

interface Exemption {
  capability: string;
  reason: string;
  seam?: string;
}
const exemptions: Record<string, Exemption> = existsSync(EXEMPT_PATH)
  ? (JSON.parse(await readFile(EXEMPT_PATH, 'utf8')) as Record<string, Exemption>)
  : {};

const errors: string[] = [];
const exempted = new Set(Object.keys(exemptions));
for (const [rn, info] of reqs) {
  if (!info.scenario) continue;
  if (anchorFiles.has(rn)) continue;
  if (exempted.has(rn)) {
    const ex = exemptions[rn]!;
    if (!ex.reason) errors.push(`豁免 ${rn} 缺 reason`);
    continue;
  }
  errors.push(`${rn}（${info.capability}）有场景但无 covers 锚且未豁免`);
}
for (const rn of exempted) {
  if (anchorFiles.has(rn)) errors.push(`豁免 ${rn} 已有锚——滞留登记请移除`);
  if (!reqs.has(rn)) errors.push(`豁免 ${rn} 指向不存在的 req`);
}

// 语义交叉检查（advisory）：有场景 + 有锚的 req，其特征 token 须至少出现在一个锚
// 文件内容里。启发式无法区分「以行为驱动但未写字面量」与「真错锚」（实测 57 命中
// 中绝大多数是前者：wire 路径模板、spec 蛇形标识符 vs 测试驼峰函数名），故只输出
// WARN 供人工复核，不阻塞门禁；r266/r408 类真错锚即由该清单暴露。
const semanticWarnings: string[] = [];
let tokenChecked = 0;
for (const [rn, info] of reqs) {
  if (!info.scenario || !anchorFiles.has(rn) || exempted.has(rn)) continue;
  const files = [...anchorFiles.get(rn)!];
  const tokens = distinctiveTokens(info.text);
  if (tokens.length === 0) continue;
  tokenChecked += tokens.length;
  const missing = tokens.filter((t) => !files.some((f) => fileContents.get(f)?.includes(t)));
  if (missing.length > 0) {
    semanticWarnings.push(
      `${rn}（${info.capability}）锚内容与场景特征无交集：缺 token [${missing.join(', ')}]` +
        `——锚点在 ${files.join(' / ')}，复核是否错锚（场景行为未被该文件测试）`,
    );
  }
}

if (errors.length > 0) {
  console.error(`[check-spec-covers] FAIL — ${errors.length} 项覆盖/登记问题:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
if (semanticWarnings.length > 0) {
  console.warn(
    `[check-spec-covers] WARN — ${semanticWarnings.length} 个错锚候选（advisory，供人工复核）:`,
  );
  for (const w of semanticWarnings) console.warn(`  - ${w}`);
}
const scenarioCount = [...reqs.values()].filter((v) => v.scenario).length;
console.log(
  `[check-spec-covers] OK — ${scenarioCount} 个有场景 req 全覆盖（锚 ${[...reqs.keys()].filter((k) => reqs.get(k)!.scenario && anchorFiles.has(k)).length} + 豁免 ${exempted.size}），语义 token 交叉检查 ${tokenChecked} 个（advisory）`,
);
