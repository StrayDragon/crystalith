# 09 — PDF 解析库实测对比（头号风险验证）

> ⚠️ 这是整个重写方案的**头号技术风险**。本文用 5 个代表性样本（含真实 PDF + 中文 + 混合排版）在 **Bun 1.3.14** 上实测 `unpdf` / `mupdf` / `pdfjs-dist`，并验证 `bun build --compile` 单二进制打包兼容性。
>
> **结论先行：风险已关闭。unpdf 是 winner。** 三引擎都能正确提取中文和文本，且 unpdf 完美支持 Bun 单二进制打包。mupdf 因 AGPL 许可 + wasm 打包问题被否决。

## 结论速览

| 库 | 文本质量 | 中文 | 速度 | Bun compile | 许可 | **结论** |
|----|------|------|------|------|------|------|
| **unpdf** | ★★★ | ✅ | 中 | ✅ **完美** | MIT | ★ **采用** |
| mupdf | ★★★★ | ✅ | **最快** | ❌ wasm 嵌入失败 | **AGPL**（与 Apache-2.0 冲突） | ✂️ 否决 |
| pdfjs-dist | ★★★ | ✅ | 中 | ⚠️ 需测（36MB 体积） | Apache-2.0 | 备选（底层引擎） |

**最终选型：`unpdf`**（基于 pdfjs-dist 封装，API 更友好，MIT 许可，Bun compile 验证通过）。mupdf 在文本提取质量和速度上略优，但 **AGPL 许可与本项目 Apache-2.0 不兼容**，且 wasm 资源在 `bun build --compile` 后无法正确嵌入（运行时报 `ENOENT: /$bunfs/root/mupdf-wasm.wasm`），双重否决。

## 实测数据（5 样本 × 3 引擎）

环境：Bun 1.3.14，Linux x64。样本见 [UPGRADES/_bench-pdf/samples/](./_bench-pdf/samples/)（2 个真实系统 PDF + 3 个生成的中文/混合/多页样本）。

### 文本提取结果

| 样本 | 大小 | 引擎 | 页数 | 耗时 | 字符数 | CJK | 首段预览 |
|------|------|------|------|------|------|------|------|
| **manual-en**（真实） | 429 KB | unpdf | 65 | 319ms | 122781 | 0 | The Speex Codec Manual Version 1.2... |
| | | mupdf | 65 | **167ms** | 123759 | 0 | （同上，一致） |
| | | pdfjs | 65 | 276ms | 128967 | 0 | （同上，一致） |
| **tech-en**（真实） | 71 KB | unpdf | 6 | 23ms | 12893 | 0 | WavPack 4 & 5 Binary File Format... |
| | | mupdf | 6 | **7ms** | 14319 | 0 | （一致） |
| | | pdfjs | 6 | 29ms | 13379 | 0 | （一致） |
| **zh**（中文） | 44 KB | unpdf | 1 | 7ms | 400 | **273** | 晶体研究工作空间：用户手册... |
| | | mupdf | 1 | **2ms** | 423 | **273** | （中文完全一致） |
| | | pdfjs | 1 | 9ms | 401 | **273** | （同上） |
| **multicol**（多页） | 3 KB | 三者 | 3 | 4–9ms | ~12900 | 0 | 一致 |
| **mixed**（混合排版） | 2 KB | 三者 | 1 | 2ms | ~450 | 0 | 一致 |

### 关键发现

1. **页数判断三者完全一致**（65 / 6 / 1 / 3 / 1）—— 引擎对文档结构解析可靠。
2. **中文提取三者完全一致**（273 个 CJK 字符全对）—— **中文支持不是问题**，风险关闭。
3. **首段文本三者完全一致** —— 基础文本提取质量可靠。
4. **字符数有微小差异**（mupdf 略多，因为结构分隔符不同），但对 RAG 分块无实质影响。
5. **速度**：mupdf 最快（2–167ms），unpdf/pdfjs 相当（7–319ms）。对桌面 app 单次提取都可接受（用户上传一个 PDF 等几百毫秒无感）。

## Bun 单二进制打包兼容性（关键！）

这是决定性测试 —— 重写目标是 `bun build --compile` 出单二进制分发。

| 库 | `bun build --compile` | 二进制大小 | 运行结果 |
|----|------|------|------|
| **unpdf** | ✅ 编译通过 | 79 MB | ✅ **运行成功，正确提取** |
| mupdf | ✅ 编译通过 | 77 MB | ❌ **运行失败**：`ENOENT: no such file or directory, open '/$bunfs/root/mupdf-wasm.wasm'` |
| pdfjs-dist | 未测（36MB 体积 + 标准 font 资源依赖，预计需额外配置） | — | — |

**mupdf 失败原因**：其 10MB 的 `mupdf-wasm.wasm` 作为外部资源引用，`bun build --compile` 没有把它嵌入虚拟文件系统 `/$bunfs/root/`。即使编译成功，运行时 wasm 加载失败。这是 Bun compile 对动态 wasm 资源处理的已知限制，需要 workaround（运行时从外部路径加载），**破坏单二进制分发目标**。

**unpdf 成功原因**：基于 pdfjs-dist 的纯 JS 实现（pdfjs 的 wasm 部分非必需），无外部 wasm 依赖，完美嵌入单二进制。

## 许可证对比（决定性）

| 库 | 许可证 | 与 crystalith (Apache-2.0) 兼容 |
|----|------|------|
| unpdf | **MIT** | ✅ |
| pdfjs-dist | Apache-2.0 | ✅ |
| **mupdf** | **AGPL-3.0**（或商业许可） | ❌ **不兼容** |

AGPL 的网络条款要求：通过网络提供服务时必须开源衍生作品。crystalith 即使是桌面 app，若 mupdf 以库形式链接进来，分发二进制时 AGPL 条款仍生效，**与 Apache-2.0 许可冲突**。除非购买 Artifex 商业许可，否则不能用。**这是 mupdf 的独立否决项**，即使它的 wasm 打包问题能解决。

## API 易用性对比

```typescript
// unpdf（最简洁）
import { extractText, getDocumentProxy } from "unpdf";
const pdf = await getDocumentProxy(new Uint8Array(buf));
const { text, totalPages } = await extractText(pdf, { mergePages: false });
// text: string[]（每页一个），totalPages: number

// mupdf（需手动遍历 + 结构化文本对象）
import mupdf from "mupdf";
const doc = mupdf.Document.openDocument(buf, "application/pdf");
const pages = [];
for (let i = 0; i < doc.countPages(); i++) {
  pages.push(doc.loadPage(i).toStructuredText().asText());
}

// pdfjs-dist（最底层，需手动 join）
const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const content = await doc.getPage(i).getTextContent();
  pages.push(content.items.map((it) => it.str).join(" "));
}
```

unpdf 的 `extractText` 一步到位，最贴合 crystalith 当前 pypdf 的用法（按页返回文本数组）。

## 与 pypdf 的对照

crystalith 当前用法（`shared/parsers/pdf.py`）：
```python
reader = PdfReader(BytesIO(content))
for page_number, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ""
    page_chunks = chunk_paragraphs(text, metadata={"page": page_number})
```

unpdf 等价实现：
```typescript
import { extractText, getDocumentProxy } from "unpdf";
async function parsePdf(buf: Uint8Array) {
  const pdf = await getDocumentProxy(buf);
  const { text: pages } = await extractText(pdf, { mergePages: false });
  return pages.map((text, i) => ({
    text,
    metadata: { page: i + 1 },
  }));
}
```

**几乎一一对应**，迁移是机械工作。当前的 `chunk_paragraphs` 分块逻辑（`shared/utils/chunker.py`）直接复用即可。

## pdfjs-dist 的 worker 陷阱（若选备选）

pdfjs-dist 6.x 默认要求 worker，但 worker 版本声明（5.6.205）与包版本（6.0.227）**包内不一致**，直接用会报 `API version does not match Worker version`。Workaround：`disableWorker: true` + 手动 import worker 模块。unpdf 已在封装层处理了这个问题，**这是选 unpdf 而非直接用 pdfjs-dist 的另一个理由**。

## 对架构决策的影响

1. **PDF 解析定 unpdf**（确认 [03](./03-ai-ecosystem-mapping.md) 的推荐 + 关闭 [05](./05-architecture-and-risks.md) 的头号风险）。
2. **`shared/parsers/pdf.py` → 等价 TS 文件**，~30 行，迁移机械。
3. **分块逻辑复用**：`chunk_paragraphs` 直接翻译。
4. **mupdf 不考虑**（AGPL + wasm 打包双重否决）。
5. **OCR 兜底**（扫描版 PDF）另议：tesseract.js（wasm）或调用云端 OCR API，作为可选增强。

## 附录：复现

```bash
cd UPGRADES/_bench-pdf
bun install                    # 装 unpdf/mupdf/pdfjs-dist
bun run bench.ts               # 文本提取对比
# 生成样本（可选）:
uv run --with fpdf2 python3 gen_samples.py
```

脚本：[bench.ts](./_bench-pdf/bench.ts)、样本生成 [gen_samples.py](./_bench-pdf/gen_samples.py)。

## 相关文档
- [03-ai-ecosystem-mapping.md](./03-ai-ecosystem-mapping.md) — AI 生态对照（本文验证其中 pypdf→unpdf 的推荐）
- [05-architecture-and-risks.md](./05-architecture-and-risks.md) — 风险表头号项现已关闭
- [02-target-stack-bun.md](./02-target-stack-bun.md) — Bun compile 单二进制是 unpdf 胜出的关键
