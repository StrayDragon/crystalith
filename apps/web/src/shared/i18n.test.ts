import { expect, test } from '@rstest/core';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t } from './i18n';

// covers: r392
test('workspace copy is centralized behind the t() message-key interface', () => {
  // 关键路径文案有稳定 message key
  expect(t('sources.upload.aria_label')).toBe('上传来源文件');
  expect(t('workspace.error_boundary.title')).toBe('组件加载失败');
  expect(t('messages.convert.failure_default')).toBe('转换失败');

  // 模板参数插值
  expect(t('sources.search.searching_elapsed', { seconds: '12' })).toContain('12 秒');
  expect(t('sources.upload.hint.filtered_ready', { unsupported: 2, supported: 5 })).toContain(
    '已过滤 2 个文件',
  );

  // 缺失 key 回退为 key 本身而非抛错
  expect(t('test.nonexistent_key' as Parameters<typeof t>[0])).toBe('test.nonexistent_key');
});

// covers: r392
test('locale baseline is zh-CN only with an extensible locale registry', () => {
  expect(SUPPORTED_LOCALES).toEqual(['zh-CN']);
  expect(DEFAULT_LOCALE).toBe('zh-CN');

  // 默认 locale 渲染中文文案
  expect(t('common.retry')).toBe('重试');
});
