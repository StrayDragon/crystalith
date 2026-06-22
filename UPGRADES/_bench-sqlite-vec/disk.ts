/**
 * 测量 sqlite-vec 持久化文件的磁盘占用 + 不同维度对比
 */
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { unlinkSync, statSync } from "node:fs";

function randUnitVec(n: number): Float32Array {
  const v = new Float32Array(n);
  let norm = 0;
  for (let i = 0; i < n; i++) { const g = gaussian(); v[i] = g; norm += g * g; }
  norm = Math.sqrt(norm);
  for (let i = 0; i < n; i++) v[i] /= norm;
  return v;
}
function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function bytesToBuf(v: Float32Array) {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}
const fmt = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";
const fnum = (n: number) => n.toLocaleString("en-US");

async function measure(dim: number, scale: number, label: string) {
  const path = `bench-${label}.db`;
  try { unlinkSync(path); unlinkSync(path + "-wal"); unlinkSync(path + "-shm"); } catch {}
  const db = new Database(path);
  sqliteVec.load(db);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE chunks (rowid INTEGER PRIMARY KEY, notebook_id INTEGER, text TEXT);
    CREATE VIRTUAL TABLE vec_chunks USING vec0(embedding float[${dim}], notebook_id integer partition by);
  `);
  const im = db.prepare("INSERT INTO chunks (rowid, notebook_id, text) VALUES (?, ?, ?)");
  const iv = db.prepare("INSERT INTO vec_chunks(rowid, notebook_id, embedding) VALUES (?, ?, ?)");
  db.exec("BEGIN");
  for (let i = 1; i <= scale; i++) {
    const v = randUnitVec(dim);
    im.run(i, (i % 10) + 1, `t${i}`);
    iv.run(i, (i % 10) + 1, bytesToBuf(v));
  }
  db.exec("COMMIT");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();

  let walSize = 0;
  try { walSize = statSync(path + "-wal").size; } catch {}
  const total = statSync(path).size + walSize;
  const perVec = total / scale;
  console.log(`${label.padEnd(16)} dim=${dim} scale=${fnum(scale)} -> ${fmt(total)} (${perVec.toFixed(0)} B/vec)`);
  try { unlinkSync(path); unlinkSync(path + "-wal"); unlinkSync(path + "-shm"); } catch {}
}

await measure(1024, 10000, "bge-m3@10k");
await measure(1024, 50000, "bge-m3@50k");
await measure(1024, 100000, "bge-m3@100k");
await measure(1536, 10000, "text-emb-3-small@10k");
await measure(1536, 50000, "text-emb-3-small@50k");
await measure(3072, 10000, "text-emb-3-large@10k");
