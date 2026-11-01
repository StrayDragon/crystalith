// covers: r28/r29（chat-ui-envelope）——静态回归守卫：server 与 web 源码树零处 "[[crystalith-ui:" 信封生成/解析，UI 元数据仅走 session sharedState 权威通道。
// Legacy envelope transport 已移除（chat-ui-envelope canonical 条目）：
// - r28: 服务端运行路径（QA 响应/SSE/消息持久化/导出）零处生成信封 delimiter
// - r29: 前端零处解析 assistant content 中的信封 marker
// 静态扫描语义：marker 字符串在源码树零出现 = 无生成/解析逻辑可回归。
import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 匹配 `[[crystalith-ui:v1]]` 及任意未来版本后缀的 delimiter 前缀。
const ENVELOPE_MARKER = /\[\[crystalith-ui:/u;

// import.meta.dirname = apps/server/tests/shared —— 相对定位两棵源码树，CWD 无关。
const SERVER_SRC = join(import.meta.dirname, '..', '..', 'src');
const WEB_SRC = join(import.meta.dirname, '..', '..', '..', 'web', 'src');

function listSourceFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // 依赖目录与构建产物不进扫描（与 check-spec-covers 同口径）。
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.tmp') {
          continue;
        }
        walk(join(current, entry.name));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(join(current, entry.name));
      }
    }
  };
  walk(dir);
  return out;
}

function filesContainingMarker(files: string[]): string[] {
  return files.filter((f) => ENVELOPE_MARKER.test(readFileSync(f, 'utf8')));
}

describe('r28: server emits no legacy chat-UI envelope', () => {
  it('apps/server/src has zero "[[crystalith-ui:" occurrences across all runtime paths', () => {
    // 恒真防护：扫描根真实存在、覆盖全部 .ts、检测器可命中 v1 delimiter 形态。
    expect(SERVER_SRC.endsWith(join('apps', 'server', 'src'))).toBe(true);
    const files = listSourceFiles(SERVER_SRC, ['.ts']);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(join('src', 'server.ts')))).toBe(true);
    expect(ENVELOPE_MARKER.test('answer [[crystalith-ui:v1]]{"ui":[]} tail')).toBe(true);

    expect(filesContainingMarker(files)).toEqual([]);
  });
});

describe('r29: web parses no legacy chat-UI envelope marker', () => {
  it('apps/web/src has zero "[[crystalith-ui:" occurrences (no marker parsing can exist)', () => {
    expect(WEB_SRC.endsWith(join('apps', 'web', 'src'))).toBe(true);
    const files = listSourceFiles(WEB_SRC, ['.ts', '.tsx']);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.includes(join('src', 'api')))).toBe(true);

    expect(filesContainingMarker(files)).toEqual([]);
  });
});
