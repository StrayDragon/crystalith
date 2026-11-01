// covers: r408（workspace-ui-panels）——上传支持集常量腿：支持集 SHALL 至少包含
// .pdf（application/pdf）与 .csv（text/csv），且 accept 字符串与预过滤集合一致。
import { expect, test } from '@rstest/core';

import {
  SOURCE_UPLOAD_ACCEPT,
  SOURCE_UPLOAD_SUPPORTED_EXTENSIONS,
  SOURCE_UPLOAD_SUPPORTED_MIME_TYPES,
} from './uploadTypes';

test('upload support set includes PDF and CSV consistently across the three surfaces', () => {
  const acceptItems = SOURCE_UPLOAD_ACCEPT.split(',');

  expect(SOURCE_UPLOAD_SUPPORTED_EXTENSIONS.has('pdf')).toBe(true);
  expect(SOURCE_UPLOAD_SUPPORTED_MIME_TYPES.has('application/pdf')).toBe(true);
  expect(SOURCE_UPLOAD_SUPPORTED_EXTENSIONS.has('csv')).toBe(true);
  expect(SOURCE_UPLOAD_SUPPORTED_MIME_TYPES.has('text/csv')).toBe(true);

  // accept 字符串与预过滤集合不漂移：扩展名与 MIME 逐一都在 accept 里。
  for (const ext of SOURCE_UPLOAD_SUPPORTED_EXTENSIONS) {
    expect(acceptItems).toContain(`.${ext}`);
  }
  for (const mime of SOURCE_UPLOAD_SUPPORTED_MIME_TYPES) {
    expect(acceptItems).toContain(mime);
  }
});
