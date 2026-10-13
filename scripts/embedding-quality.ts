// c131 T7 — EmbeddingGemma 2 real-model quality gate (manual, NOT CI).
//
// Validates against a live gateway (default: maas-embeddinggemma2 at
// tufa:50233; override with --base or CL_EMBEDDING2_API_BASE):
//   1. Prefix parity — the engine's client-side templates must produce vectors
//      identical to the server-side model-suffix prompts (:SearchQuery /
//      :Document), cos ≥ 0.999999.
//   2. Self-retrieval — zh / zh+en / code corpora, top-1 hit rate per corpus.
//   3. Latency baseline — single + batch×32 timings.
//
// Usage: bun scripts/embedding-quality.ts [--base http://host:port/v1]
import { PREFIX_PRESETS } from '../apps/server/src/rag/embedding-engine.ts';

const args = process.argv.slice(2);
const baseFlag = args.findIndex((a) => a === '--base');
const BASE =
  baseFlag >= 0
    ? (args[baseFlag + 1] ?? '')
    : (process.env.CL_EMBEDDING2_API_BASE ?? 'http://tufa:50233/v1');
const MODEL = 'embeddinggemma-2';
const preset = PREFIX_PRESETS.embeddinggemma2;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { total_tokens?: number };
}

async function embedOnce(model: string, input: string | string[]): Promise<number[][]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as EmbeddingResponse;
  return body.data.map((d) => d.embedding);
}

/**
 * The gateway serializes batches behind a single-flight lock; rapid
 * back-to-back calls can surface a transient 5xx — retry once, briefly.
 */
async function embed(model: string, input: string | string[]): Promise<number[][]> {
  try {
    return await embedOnce(model, input);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    return embedOnce(model, input);
  }
}

function cos(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // service guarantees unit vectors
}

const CORPORA: Array<{ name: string; query: string; docs: string[] }> = [
  {
    name: '中文',
    query: '如何配置数据库连接池',
    docs: [
      '数据库连接池通过最大连接数与空闲超时两个参数控制资源占用，配置位于 settings.database 段。',
      '前端路由使用懒加载拆分代码包，首屏体积下降了约百分之四十。',
      '向量检索默认使用余弦相似度，分数转换公式为一减去距离值。',
      '会议纪要应包含参与人、决议事项与后续行动项三个部分。',
      '单元测试要求每个文件自给自足，不得依赖跨文件的模块状态泄漏。',
      '烘焙面包时面团发酵温度宜控制在二十八摄氏度左右，时间约一小时。',
    ],
  },
  {
    name: '中英混合',
    query: 'docker compose 部署 postgres 的端口映射写法',
    docs: [
      'docker-compose.yml 中 ports 字段写作 "5432:5432"，宿主机端口在前，容器端口在后。',
      'The retry middleware uses exponential backoff with a 30 second ceiling.',
      'Kubernetes 的 Service 通过 selector 匹配 Pod 标签， ClusterIP 默认仅在集群内可达。',
      '缓存失效策略基于 epoch 计数器，任意写操作都会令对应 key 失效。',
      'Export the report as PDF, then attach it to the weekly digest email.',
      '音视频转码任务由后台队列串行处理，避免同时抢占 GPU。',
    ],
  },
  {
    name: '代码',
    query: '对数组按分数排序并取前 K 个的函数',
    docs: [
      'function topK(items, k) { return items.sort((a, b) => b.score - a.score).slice(0, k); }',
      'const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };',
      'def load_config(path):\n    with open(path) as f:\n        return yaml.safe_load(f)',
      'SELECT id, name FROM users WHERE active = 1 ORDER BY created_at DESC LIMIT 20;',
      'async function fetchWithRetry(url, n = 3) { for (let i = 0; i < n; i++) { try { return await fetch(url); } catch {} } throw new Error("retries exhausted"); }',
      'class LRUCache {\n  constructor(cap) { this.cap = cap; this.map = new Map(); }\n}',
    ],
  },
];

async function checkPrefixParity(): Promise<boolean> {
  const probe = '如何重建嵌入索引';
  const docText = '重建索引会先清空旧向量再逐来源重新嵌入。';
  const [serverQ, clientQ, serverD, clientD] = await Promise.all([
    embed(`${MODEL}:SearchQuery`, probe),
    embed(MODEL, preset.query(probe)),
    embed(`${MODEL}:Document`, docText),
    embed(MODEL, preset.document(undefined, docText)),
  ]);
  const qCos = cos(serverQ[0], clientQ[0]);
  const dCos = cos(serverD[0], clientD[0]);
  const ok = qCos >= 0.999999 && dCos >= 0.999999;
  console.log(
    `[quality] prefix parity: query cos=${qCos.toFixed(8)} document cos=${dCos.toFixed(8)} → ${ok ? 'PASS' : 'FAIL'} (≥0.999999)`,
  );
  return ok;
}

async function checkSelfRetrieval(corpus: (typeof CORPORA)[number]): Promise<boolean> {
  const docVecs = await embed(
    MODEL,
    corpus.docs.map((d) => preset.document(undefined, d)),
  );
  const queryVec = (await embed(MODEL, preset.query(corpus.query)))[0];
  const ranked = docVecs
    .map((v, i) => ({ i, score: cos(v, queryVec) }))
    .sort((a, b) => b.score - a.score);
  const hit = ranked[0].i === 0; // the first doc is the designed hit
  console.log(
    `[quality] self-retrieval [${corpus.name}]: top1=${corpus.docs[0].slice(0, 24)}… hit=${hit ? 'PASS' : 'FAIL'} (top3: ${ranked
      .slice(0, 3)
      .map((r) => `#${r.i}:${r.score.toFixed(3)}`)
      .join(' ')})`,
  );
  return hit;
}

async function reportLatencyBaseline(): Promise<void> {
  const singles: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await embed(MODEL, '延迟基线测量文本');
    singles.push(performance.now() - t0);
  }
  singles.sort((a, b) => a - b);
  const singleP50 = singles[Math.floor(singles.length / 2)];

  const batchTexts = Array.from({ length: 32 }, (_, i) => `批量基线第 ${i} 条样本文本`);
  const batches: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await embed(MODEL, batchTexts);
    batches.push(performance.now() - t0);
  }
  const batchMean = batches.reduce((a, b) => a + b, 0) / batches.length;

  console.log(
    `[quality] latency: single p50=${singleP50.toFixed(0)}ms · batch×32 mean=${batchMean.toFixed(0)}ms (~${((32 / batchMean) * 1000).toFixed(0)}/s)`,
  );
}

async function main(): Promise<number> {
  console.log(`[quality] gateway ${BASE} model ${MODEL}`);
  const parityOk = await checkPrefixParity();
  const retrievalOk = await Promise.all(CORPORA.map(checkSelfRetrieval));
  await reportLatencyBaseline();
  const failed = [parityOk, ...retrievalOk].filter((ok) => !ok).length;
  console.log(failed === 0 ? '[quality] ALL PASS' : `[quality] ${failed} check(s) FAILED`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
