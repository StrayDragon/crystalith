import { expect, test } from 'vitest';

import {
  SOURCE_UPLOAD_ACCEPT,
  SOURCE_UPLOAD_SUPPORTED_EXTENSIONS,
  SOURCE_UPLOAD_SUPPORTED_MIME_TYPES,
} from './uploadTypes';

test('source upload accept list includes CSV', () => {
  expect(SOURCE_UPLOAD_SUPPORTED_EXTENSIONS.has('csv')).toBe(true);
  expect(SOURCE_UPLOAD_SUPPORTED_MIME_TYPES.has('text/csv')).toBe(true);
  expect(SOURCE_UPLOAD_ACCEPT).toContain('.csv');
  expect(SOURCE_UPLOAD_ACCEPT).toContain('text/csv');
});
