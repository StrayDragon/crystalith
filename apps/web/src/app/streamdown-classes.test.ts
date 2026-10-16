/**
 * c136 T5: streamdown（含 @streamdown/code）样式供给 lock-test。
 *
 * streamdown dist 内消费的 tailwind 类不经过本仓源码——供给靠
 * `streamdown-sources.css` 的 `@source inline(...)` 白名单（oxide 拒绝相对
 * 路径扫 node_modules，见 c136 design）。本测试锁：动态扫描 dist 中「本仓
 * @theme token 消费类」（丢了即白屏级）⊆ 白名单。
 *
 * 白名单「能被真实 @tailwindcss/postcss 编译生成」无 rstest 锁（测试环境加载不了
 * lightningcss 原生模块），由 e2e / 亮暗巡检兜底。streamdown 升级若引入新 token
 * 类 → 本测试红 → 按白名单文件头注释的权威差分法更新清单；标准 palette 类缺失属
 * 视觉退化，同样由 e2e/巡检兜底。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@rstest/core';

const APP_DIR = import.meta.dirname;
const WEB_ROOT = join(APP_DIR, '..', '..');

/** 解析 streamdown-sources.css 的 @source inline 白名单。 */
function parseWhitelist(): string[] {
  const css = readFileSync(join(APP_DIR, 'streamdown-sources.css'), 'utf8');
  const m = css.match(/@source inline\("([^"]+)"\)/);
  if (!m) throw new Error('streamdown-sources.css 缺少 @source inline(...) 指令');
  return m[1].split(/\s+/).filter(Boolean);
}

/** 收集 streamdown dist 内消费「我们 @theme token」的类（白屏级风险面）。 */
function collectTokenClassesFromDist(): Set<string> {
  const roots = [
    join(WEB_ROOT, 'node_modules', 'streamdown', 'dist'),
    join(WEB_ROOT, 'node_modules', '@streamdown', 'code', 'dist'),
  ];
  // 整 token 锚定匹配（先按非类名字符切分，避免 text-muted-foreground 产生
  // text-muted 子串误报）：(变体:)*（bg|…）-(token)(/透明度)?
  const tokenRe =
    /^(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|to|via)-(?:background|foreground|muted|muted-foreground|border|sidebar|primary|primary-foreground)(?:\/[\d.]+)?$/u;
  const found = new Set<string>();
  const files = roots
    .filter((root) => existsSync(root))
    .flatMap((root) =>
      readdirSync(root)
        .filter((f) => f.endsWith('.js'))
        .map((f) => join(root, f)),
    );
  for (const file of files) {
    for (const t of readFileSync(file, 'utf8').split(/[^a-zA-Z0-9:./()[\]%-]+/u)) {
      if (tokenRe.test(t)) found.add(t);
    }
  }
  return found;
}

describe('c136 streamdown 样式供给 lock-test', () => {
  it('白名单非空且无重复', () => {
    const whitelist = parseWhitelist();
    expect(whitelist.length).toBeGreaterThan(50);
    expect(new Set(whitelist).size).toBe(whitelist.length);
  });

  it('dist 消费的 @theme token 类全部在白名单内（streamdown 升级防漏）', () => {
    const whitelist = new Set(parseWhitelist());
    const missing = [...collectTokenClassesFromDist()].filter((c) => !whitelist.has(c));
    expect(missing).toEqual([]);
  });
});
