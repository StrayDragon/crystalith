// 录制脚本：经真实网关把语料与查询嵌入为全维向量，落盘 vectors.fixture.json。
// 用法：cd apps/server && CL_MRL_EVAL_BASE=<openai-compatible 网关> bun tests/rag/mrl-eval/generate.ts
// env：CL_MRL_EVAL_BASE（必填）/ CL_MRL_EVAL_KEY / CL_MRL_EVAL_MODEL（见缺省）。
// 前缀与 embedding-engine r475 的 embeddinggemma2 预设逐字一致（公平对比前提）。
import { CORPUS } from './corpus.ts';
import { saveFixture } from './fixture.ts';
import { QUERIES } from './queries.ts';

const BASE = process.env.CL_MRL_EVAL_BASE;
const KEY = process.env.CL_MRL_EVAL_KEY ?? 'local';
const MODEL = process.env.CL_MRL_EVAL_MODEL ?? 'embeddinggemma-2';

if (!BASE) {
  throw new Error(
    'CL_MRL_EVAL_BASE 未设置——录制需要指向 openai-compatible 嵌入网关（判定基准须用声明 ≥768 维且含 mrlDims 的模型）',
  );
}

const docInput = (title: string, text: string) => `title: ${title} | text: ${text}`;
const queryInput = (q: string) => `task: search result | query: ${q}`;

async function embed(inputs: string[]): Promise<number[][]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const docVecs = await embed(CORPUS.map((d) => docInput(d.title, d.text)));
const queryVecs = await embed(QUERIES.map((q) => queryInput(q.text)));
const dims = docVecs[0]!.length;
if (queryVecs.some((v) => v.length !== dims)) throw new Error('inconsistent dims from gateway');
console.log(
  `embedded ${docVecs.length} docs + ${queryVecs.length} queries @ ${dims} dims (${MODEL})`,
);

const docs: Record<string, number[]> = {};
CORPUS.forEach((d, i) => {
  docs[d.id] = docVecs[i]!;
});
const queries: Record<string, number[]> = {};
QUERIES.forEach((q, i) => {
  queries[q.id] = queryVecs[i]!;
});
saveFixture({
  model: MODEL,
  dims,
  generatedAt: new Date().toISOString(),
  docs,
  queries,
});
console.log('fixture saved: tests/rag/mrl-eval/vectors.fixture.json');
