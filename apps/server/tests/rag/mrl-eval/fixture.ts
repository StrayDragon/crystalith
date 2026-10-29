// 录制向量 fixture：一次性经真实网关生成全维向量并落盘，eval 离线可复现。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CORPUS } from './corpus.ts';
import { QUERIES } from './queries.ts';

export interface EvalFixture {
  model: string;
  dims: number;
  generatedAt: string;
  gateway: string;
  docs: Record<string, number[]>;
  queries: Record<string, number[]>;
}

const FIXTURE_PATH = join(import.meta.dirname, 'vectors.fixture.json');

export function fixtureExists(): boolean {
  return existsSync(FIXTURE_PATH);
}

export function loadFixture(): EvalFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as EvalFixture;
}

export function saveFixture(f: EvalFixture): void {
  writeFileSync(FIXTURE_PATH, JSON.stringify(f));
}

/** fixture 完整性：维度一致、条数与语料/查询对齐。 */
export function checkFixtureIntegrity(f: EvalFixture): string[] {
  const problems: string[] = [];
  const docIds = Object.keys(f.docs).sort();
  const queryIds = Object.keys(f.queries).sort();
  const wantDocs = CORPUS.map((d) => d.id).sort();
  const wantQueries = QUERIES.map((q) => q.id).sort();
  if (JSON.stringify(docIds) !== JSON.stringify(wantDocs)) problems.push('doc ids mismatch corpus');
  if (JSON.stringify(queryIds) !== JSON.stringify(wantQueries))
    problems.push('query ids mismatch queries');
  const all = [...Object.values(f.docs), ...Object.values(f.queries)];
  if (all.some((v) => v.length !== f.dims)) problems.push(`some vectors are not ${f.dims}-dim`);
  return problems;
}
