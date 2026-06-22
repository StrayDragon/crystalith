/**
 * PDF 提取库对比 benchmark
 * 对比: unpdf / mupdf / pdfjs-dist
 * 维度: 能否加载、文本提取质量、页数、耗时、中文支持
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const SAMPLES_DIR = join(import.meta.dir, "samples");

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

// ---------- unpdf ----------
async function extractUnpdf(buf: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  return { pages: text as string[], totalPages };
}

// ---------- mupdf ----------
async function extractMupdf(buf: Uint8Array) {
  const mupdf = await import("mupdf");
  const Document = mupdf.Document;
  const doc = Document.openDocument(buf, "application/pdf");
  const n = doc.countPages();
  const pages: string[] = [];
  for (let i = 0; i < n; i++) {
    pages.push(doc.loadPage(i).toStructuredText().asText());
  }
  return { pages, totalPages: n };
}

// ---------- pdfjs-dist ----------
async function extractPdfjs(buf: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  // 用同进程 fake worker 规避 worker 加载
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs");
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = ""; // disable
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerPort = null;
  const data = new Uint8Array(buf);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableWorker: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    pages.push(text);
  }
  return { pages, totalPages: doc.numPages };
}

function summary(text: string): string {
  if (!text) return "(空)";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.slice(0, 120) + (clean.length > 120 ? "..." : "");
}

const ENGINES: Array<{ name: string; fn: (b: Uint8Array) => Promise<{ pages: string[]; totalPages: number }> }> = [
  { name: "unpdf", fn: extractUnpdf },
  { name: "mupdf", fn: extractMupdf },
  { name: "pdfjs", fn: extractPdfjs },
];

async function main() {
  const files = (await readdir(SAMPLES_DIR)).filter((f) => f.endsWith(".pdf")).sort();
  console.log(`Bun ${Bun.version} | samples: ${files.length}\n`);

  for (const file of files) {
    const buf = await readFile(join(SAMPLES_DIR, file));
    console.log(`\n### ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
    for (const engine of ENGINES) {
      try {
        const { result, ms } = await time(engine.name, () => engine.fn(buf));
        const allText = result.pages.join("\n");
        const totalChars = allText.length;
        const chineseChars = (allText.match(/[\u4e00-\u9fff]/g) || []).length;
        console.log(`  ${engine.name.padEnd(8)} pages=${result.totalPages}  ${ms.toFixed(0).padStart(4)}ms  chars=${totalChars}  cjk=${chineseChars}`);
        console.log(`           p1: ${summary(result.pages[0] || "")}`);
      } catch (e: any) {
        console.log(`  ${engine.name.padEnd(8)} ✗ ${e?.name}: ${(e?.message || "").slice(0, 100)}`);
      }
    }
  }
}
main();
