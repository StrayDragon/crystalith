// c136 T5: streamdown 白名单「配置有效性」验证（纯 node——rstest/Rspack 环境加载不了
// lightningcss 原生模块，故从 rstest 拆出）。用法：bun scripts/verify-streamdown-css.mjs
// 流程：postcss + @tailwindcss/postcss 真实编译 tailwind.css → 断言白名单全部类生成。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/postcss';
import postcss from 'postcss';

const appDir = join(fileURLToPath(new URL('../src/app', import.meta.url)));
const whitelistSrc = readFileSync(join(appDir, 'streamdown-sources.css'), 'utf8');
const m = whitelistSrc.match(/@source inline\("([^"]+)"\)/u);
if (!m) throw new Error('streamdown-sources.css 缺少 @source inline(...) 指令');
const whitelist = m[1].split(/\s+/u).filter(Boolean);

const css = readFileSync(join(appDir, 'tailwind.css'), 'utf8');
const result = await postcss([tailwind()]).process(css, { from: join(appDir, 'tailwind.css') });
const out = result.css;

const missing = whitelist.filter((cls) => {
  // 产物中 arbitrary 值内的逗号同样被转义（text-[var(--a,b)] → text-\[var\(--a\,b\)\]）
  const escaped = cls.replace(/[:/[\]().%,]/g, (ch) => `\\${ch}`);
  return !out.includes(`.${escaped}`);
});

if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} 个白名单类未生成:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `OK: ${whitelist.length} 个 streamdown 白名单类全部生成（产物 ${(out.length / 1024).toFixed(1)} KB）`,
);
