// 本地快速调试运行器 — 免启服直接驱动本插件。
//
// 用法（仓库根目录执行）：
//   bun packages/plugin-extractor-arxiv/scripts/try.ts https://arxiv.org/abs/1706.03762
//   bun packages/plugin-extractor-arxiv/scripts/try.ts <非 arxiv URL>   # 观察降级（空内容）
//
// 网络：走宿主同款出站链路（outboundFetch），代理由 CL_PROXY_* / config/app.yaml
// 的 proxy_settings 控制；也可临时用 HTTPS_PROXY 环境变量覆盖（见 docs/plugins.md）。
import { outboundFetch } from '../../../apps/server/src/shared/net/outbound-fetch.ts';
import { extractorArxiv } from '../src/index.ts';

const urls = Bun.argv.slice(2);
if (urls.length === 0) {
  console.error(
    '用法: bun packages/plugin-extractor-arxiv/scripts/try.ts <arxiv-abs-url> [more...]',
  );
  process.exit(1);
}

const impl = await extractorArxiv.factory({
  config: {},
  dataRoot: process.cwd(),
  fetch: outboundFetch,
});

for (const url of urls) {
  console.log(`\n=== ${url} ===`);
  try {
    const result = await impl.extract(url, {});
    if (!result.content.trim()) {
      console.log('（空内容 → 编排层会降级到下一个提取器）');
      continue;
    }
    const headings = [...result.content.matchAll(/^## .+$/gmu)].map((m) => m[0]);
    console.log(`title: ${result.title}`);
    console.log(`extractorUsed: ${result.extractorUsed}`);
    console.log(`content length: ${result.content.length} chars`);
    console.log(`sections: ${headings.join(' | ') || '(none)'}`);
    console.log('---');
    console.log(result.content.slice(0, 600));
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  }
}
