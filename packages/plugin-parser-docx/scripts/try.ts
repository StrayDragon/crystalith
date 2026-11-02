// 本地快速调试运行器 — 免启服直接驱动本插件。
//
// 用法（仓库根目录执行）：
//   bun packages/plugin-parser-docx/scripts/try.ts path/to/file.docx
import { parserDocx } from '../src/index.ts';

const files = Bun.argv.slice(2);
if (files.length === 0) {
  console.error('用法: bun packages/plugin-parser-docx/scripts/try.ts <file.docx> [more...]');
  process.exit(1);
}

const impl = await parserDocx.factory({
  config: {},
  dataRoot: process.cwd(),
  fetch,
});

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  try {
    const buf = new Uint8Array(await Bun.file(file).arrayBuffer());
    const result = await impl.parse(buf, file);
    console.log(`text length: ${result.text.length} chars`);
    console.log('---');
    console.log(result.text.slice(0, 800));
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
  }
}
