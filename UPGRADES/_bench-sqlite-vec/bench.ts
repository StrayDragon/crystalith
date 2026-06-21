/**
 * sqlite-vec benchmark on Bun
 *
 * 测试场景（贴合 crystalith RAG 用法）:
 *  - 维度 1024 (bge-m3 类 embedding)
 *  - 余弦相似 (归一化向量)
 *  - 不同规模: 1k / 10k / 50k / 100k chunks
 *  - 测: 插入吞吐、单次查询延迟、top-10 查询、带 metadata filter
 */
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";

const DIM = 1024;

function randUnitVec(n: number): Float32Array {
  const v = new Float32Array(n);
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const g = gaussian();
    v[i] = g;
    norm += g * g;
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < n; i++) v[i] /= norm;
  return v;
}

// Box-Muller
function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function bytesToBuf(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

async function bench(scale: number) {
  const dbPath = `:memory:`;
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.exec("PRAGMA journal_mode = WAL;");

  // metadata 表 + 向量表
  db.exec(`
    CREATE TABLE chunks (
      rowid INTEGER PRIMARY KEY,
      notebook_id INTEGER,
      source_id INTEGER,
      text TEXT
    );
    CREATE VIRTUAL TABLE vec_chunks USING vec0(
      embedding float[${DIM}],
      notebook_id integer partition by,
      source_id integer partition by
    );
  `);

  const insertMeta = db.prepare(
    "INSERT INTO chunks (rowid, notebook_id, source_id, text) VALUES (?, ?, ?, ?)"
  );
  // sqlite-vec: partition columns go after rowid, before vector
  const insertVec = db.prepare(
    "INSERT INTO vec_chunks(rowid, notebook_id, source_id, embedding) VALUES (?, ?, ?, ?)"
  );

  // --- 插入 ---
  const tIns0 = performance.now();
  const tx = db.transaction(() => {});
  db.exec("BEGIN");
  for (let i = 1; i <= scale; i++) {
    const v = randUnitVec(DIM);
    insertMeta.run(i, (i % 10) + 1, (i % 100) + 1, `chunk text ${i}`);
    insertVec.run(i, (i % 10) + 1, (i % 100) + 1, bytesToBuf(v));
  }
  db.exec("COMMIT");
  const tIns = performance.now() - tIns0;

  // --- 单次查询（无 filter）---
  const q = randUnitVec(DIM);
  const searchNoFilter = db.prepare(
    `SELECT rowid, distance FROM vec_chunks
     WHERE embedding MATCH ? AND k = 10
     ORDER BY distance`
  );

  // warmup
  for (let i = 0; i < 5; i++) searchNoFilter.all(bytesToBuf(q));

  const N = 200;
  const latNo: number[] = [];
  for (let i = 0; i < N; i++) {
    const qv = randUnitVec(DIM);
    const t0 = performance.now();
    searchNoFilter.all(bytesToBuf(qv));
    latNo.push(performance.now() - t0);
  }
  latNo.sort((a, b) => a - b);
  const p50 = latNo[Math.floor(N * 0.5)];
  const p95 = latNo[Math.floor(N * 0.95)];
  const p99 = latNo[Math.floor(N * 0.99)];

  // --- 带 partition filter (notebook_id = 1) ---
  const searchFiltered = db.prepare(
    `SELECT rowid, distance FROM vec_chunks
     WHERE embedding MATCH ? AND k = 10 AND notebook_id = 1
     ORDER BY distance`
  );
  for (let i = 0; i < 5; i++) searchFiltered.all(bytesToBuf(q));
  const latF: number[] = [];
  for (let i = 0; i < N; i++) {
    const qv = randUnitVec(DIM);
    const t0 = performance.now();
    searchFiltered.all(bytesToBuf(qv));
    latF.push(performance.now() - t0);
  }
  latF.sort((a, b) => a - b);
  const p50f = latF[Math.floor(N * 0.5)];
  const p95f = latF[Math.floor(N * 0.95)];

  const insPerSec = (scale / (tIns / 1000)) | 0;

  console.log(
    [
      `scale=${fmt(scale)}`.padEnd(12),
      `insert ${fmt(tIns | 0)}ms`.padEnd(18),
      `(${fmt(insPerSec)} rows/s)`.padEnd(18),
      `query p50/p95/p99`,
      `${p50.toFixed(2)}/${p95.toFixed(2)}/${p99.toFixed(2)} ms`,
      `| filtered p50/p95 ${p50f.toFixed(2)}/${p95f.toFixed(2)} ms`,
    ].join(" ")
  );

  db.close();
}

const main = async () => {
  console.log(`Bun ${Bun.version} | sqlite-vec 0.1.9 | dim=${DIM} | cos (unit) | top-10\n`);
  for (const s of [1000, 10000, 50000, 100000]) {
    await bench(s);
  }
};
main();
