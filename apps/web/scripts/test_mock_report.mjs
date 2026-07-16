#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const scriptDir = import.meta.dirname;
const frontendDir = path.resolve(scriptDir, '..');
const srcDir = path.resolve(frontendDir, 'src');
const scriptsDir = path.resolve(frontendDir, 'scripts');

const argv = process.argv.slice(2);
const checkMockReasons = argv.includes('--check-mock-reasons');

const VI_OPS = {
  mock: 0,
  spyOn: 0,
  stubGlobal: 0,
  useFakeTimers: 0,
  setSystemTime: 0,
  hoisted: 0,
};

function isTestFile(filePath) {
  return /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(filePath);
}

function isExperimentalTestFile(filePath) {
  return /\.experimental\.(test|spec)\./u.test(filePath);
}

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dirPath, out) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
}

function analyzeFile(filePath) {
  const text = readFileUtf8(filePath);
  const hasMockReason = text.includes('Mock reason:');
  const isExperimental = isExperimentalTestFile(filePath);

  /** @type {Record<string, number>} */
  const opCounts = { ...VI_OPS };

  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind);

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'vi'
      ) {
        const name = expr.name.text;
        if (name in opCounts) {
          opCounts[name] += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const totalOps = Object.values(opCounts).reduce((acc, value) => acc + value, 0);
  return { filePath, isExperimental, hasMockReason, opCounts, totalOps };
}

const allPaths = [];
walkFiles(srcDir, allPaths);
walkFiles(scriptsDir, allPaths);

const testFiles = allPaths
  .filter((filePath) => isTestFile(filePath))
  .toSorted((a, b) => a.localeCompare(b));
const results = testFiles.map((filePath) => analyzeFile(filePath));

const filesWithOps = results.filter((result) => result.totalOps > 0);
const reasonHits = results.reduce((acc, result) => {
  if (!result.hasMockReason) return acc;
  const text = readFileUtf8(result.filePath);
  return acc + (text.match(/Mock reason:/gu)?.length ?? 0);
}, 0);
const totalOps = results.reduce((acc, result) => acc + result.totalOps, 0);

const gatedFilesMissingReason = checkMockReasons
  ? filesWithOps.filter((result) => !result.isExperimental && !result.hasMockReason)
  : [];

console.log('== Frontend Test Doubles / Mock Usage Report ==');
console.log(`Test files: ${testFiles.length}`);
console.log(
  `vi patch ops: ${filesWithOps.length} (${((filesWithOps.length / Math.max(1, testFiles.length)) * 100).toFixed(2)}%)`,
);
console.log('');
console.log('== Mock Reason Coverage ==');
console.log(`"Mock reason:" hits: ${reasonHits}`);
console.log(`vi ops: ${totalOps}`);
console.log(`reasons per vi op: ${(reasonHits / Math.max(1, totalOps)).toFixed(2)}`);

console.log('');
console.log('== Hotspots (by vi-op count) ==');
const hotspots = [...filesWithOps]
  .toSorted((a, b) => b.totalOps - a.totalOps || a.filePath.localeCompare(b.filePath))
  .slice(0, 15);

for (const result of hotspots) {
  const relativePath = path.relative(frontendDir, result.filePath);
  const flags = result.isExperimental ? ' experimental' : '';
  console.log(`- ${relativePath} (ops=${result.totalOps}${flags})`);
}

if (checkMockReasons) {
  if (gatedFilesMissingReason.length === 0) {
    console.log('');
    console.log('== Mock Reason Gate ==');
    console.log(
      'OK: All stable test files that use vi patch ops contain at least one `Mock reason:`.',
    );
    process.exit(0);
  }

  console.error('');
  console.error('== Mock Reason Gate ==');
  console.error('FAIL: Missing `Mock reason:` in stable test files using vi patch ops:');
  for (const result of gatedFilesMissingReason) {
    console.error(`- ${path.relative(frontendDir, result.filePath)}`);
  }
  process.exit(1);
}
