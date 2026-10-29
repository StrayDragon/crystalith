// r495 eval runner：三组维度（768 基线 / 512 / 256）KNN 对比 recall@10 与 nDCG@10。
// 用法：cd apps/server && bun tests/rag/mrl-eval/eval.ts
// 退出码：0 = go（256 维 recall@10 相对衰减 ≤ 5%）；1 = no-go。
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createDb, resetDb, type Orm } from '../../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../../src/db/schema.ts';
import { insertChunkVector, recreateVecChunks, searchVectors } from '../../../src/db/vectors.ts';
import { CORPUS } from './corpus.ts';
import { checkFixtureIntegrity, fixtureExists, loadFixture } from './fixture.ts';
import { decayPct, ndcgAtK, recallAtK } from './metrics.ts';
import { QUERIES } from './queries.ts';
import { sliceNormalize } from './truncate.ts';

export const NOGO_DECAY_PCT = 5;
export const EVAL_DIMS = [768, 512, 256];

interface PerQuery {
  id: string;
  recall10: number;
  ndcg10: number;
  hitIds: string[];
}

interface DimResult {
  dims: number;
  recall10: number;
  ndcg10: number;
  perQuery: PerQuery[];
}

async function insertCorpus(
  orm: Orm,
  dims: number,
  docVecs: Record<string, number[]>,
  notebookId: number,
  sourceId: number,
  rowidToDoc: Map<number, string>,
): Promise<void> {
  for (const [chunkId, docId] of rowidToDoc) {
    await insertChunkVector(
      orm,
      chunkId,
      notebookId,
      sourceId,
      sliceNormalize(docVecs[docId]!, dims),
    );
  }
}

async function runQueries(
  orm: Orm,
  dims: number,
  queryVecs: Record<string, number[]>,
  notebookId: number,
  rowidToDoc: Map<number, string>,
): Promise<PerQuery[]> {
  const perQuery: PerQuery[] = [];
  for (const q of QUERIES) {
    const hits = await searchVectors(orm, sliceNormalize(queryVecs[q.id]!, dims), notebookId, 10);
    const hitIds = hits.map((h) => rowidToDoc.get(h.rowid)!);
    const relevant = new Set(q.expected);
    perQuery.push({
      id: q.id,
      recall10: recallAtK(hitIds, relevant, 10),
      ndcg10: ndcgAtK(hitIds, relevant, 10),
      hitIds,
    });
  }
  return perQuery;
}

async function evalAtDims(
  dims: number,
  docVecs: Record<string, number[]>,
  queryVecs: Record<string, number[]>,
): Promise<DimResult> {
  const dbPath = `data/test-mrl-eval-${dims}.db`;
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) rmSync(f, { force: true });
  const orm: Orm = createDb(dbPath);
  resetDb(orm);
  recreateVecChunks(orm, dims);
  const [nb] = orm
    .insert(notebooks)
    .values({ name: `mrl-eval-${dims}` })
    .returning()
    .all();
  const [src] = orm
    .insert(sources)
    .values({ notebookId: nb.id, filename: `mrl-eval-${dims}.md`, status: 'ready' })
    .returning()
    .all();
  const rowidToDoc = new Map<number, string>();
  CORPUS.forEach((doc, i) => {
    const [chk] = orm
      .insert(chunks)
      .values({ sourceId: src.id, chunkIndex: i, text: doc.text })
      .returning()
      .all();
    rowidToDoc.set(chk.id, doc.id);
  });
  await insertCorpus(orm, dims, docVecs, nb.id, src.id, rowidToDoc);
  const perQuery = await runQueries(orm, dims, queryVecs, nb.id, rowidToDoc);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const dbFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  resetDb(null);
  for (const f of dbFiles) rmSync(f, { force: true });
  return {
    dims,
    recall10: mean(perQuery.map((p) => p.recall10)),
    ndcg10: mean(perQuery.map((p) => p.ndcg10)),
    perQuery,
  };
}

function writeReports(results: DimResult[], decay256: number, verdict: string): void {
  const dir = join(import.meta.dirname, 'reports');
  mkdirSync(dir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const json = {
    generatedAt,
    thresholdPct: NOGO_DECAY_PCT,
    results: results.map(({ dims, recall10, ndcg10 }) => ({ dims, recall10, ndcg10 })),
    decay256Pct: decay256,
    verdict,
    perQuery: Object.fromEntries(results.map((r) => [r.dims, r.perQuery])),
  };
  writeFileSync(join(dir, 'mrl-eval-report.json'), JSON.stringify(json, null, 2));
  const base = results[0]!;
  const md = [
    '# MRL 截断 eval 报告',
    '',
    `- 生成时间：${generatedAt}`,
    `- 判据：256 维 recall@10 相对 ${base.dims} 基线衰减 > ${NOGO_DECAY_PCT}% 即 no-go`,
    '',
    '| dims | recall@10 | nDCG@10 | 相对衰减 |',
    '| --- | --- | --- | --- |',
    ...results.map(
      (r) =>
        `| ${r.dims} | ${r.recall10.toFixed(4)} | ${r.ndcg10.toFixed(4)} | ${decayPct(base.recall10, r.recall10).toFixed(2)}% |`,
    ),
    '',
    `## 结论：${verdict}`,
    '',
  ].join('\n');
  writeFileSync(join(dir, 'mrl-eval-report.md'), md);
  console.log(md);
}

/** go/no-go 判定（r495：256 维 recall@10 相对基线衰减 > 5% 即 no-go）。 */
function computeVerdict(results: DimResult[]): { decay256: number; verdict: string } {
  const baseline = results[0]!;
  const at256 = results.find((r) => r.dims === 256);
  const decay = at256 ? decayPct(baseline.recall10, at256.recall10) : 0;
  return { decay256: decay, verdict: decay > NOGO_DECAY_PCT ? 'no-go' : 'go' };
}

/** 装载并校验 fixture（缺失/不完整即抛，错误信息指向录制命令）。 */
function loadIntegralFixture() {
  if (!fixtureExists()) {
    throw new Error('fixture missing — run: bun tests/rag/mrl-eval/generate.ts');
  }
  const fixture = loadFixture();
  const problems = checkFixtureIntegrity(fixture);
  if (problems.length > 0) throw new Error(`fixture integrity: ${problems.join('; ')}`);
  return fixture;
}

async function main(): Promise<void> {
  const fixture = loadIntegralFixture();
  const dimsList = EVAL_DIMS.filter((d) => d <= fixture.dims);
  const results: DimResult[] = [];
  for (const d of dimsList) {
    results.push(await evalAtDims(d, fixture.docs, fixture.queries));
  }
  const { decay256, verdict } = computeVerdict(results);
  writeReports(results, decay256, verdict);
  if (verdict === 'no-go') process.exit(1);
}

void main();
