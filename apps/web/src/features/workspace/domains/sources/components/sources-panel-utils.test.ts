import { expect, test } from 'vitest';

import { normalizeSearchMode, splitUploadFiles } from './sources-panel-utils';

test('normalizeSearchMode returns Fast Research for null or invalid values', () => {
  expect(normalizeSearchMode(null)).toBe('Fast Research');
  expect(normalizeSearchMode('')).toBe('Fast Research');
  expect(normalizeSearchMode('Unknown')).toBe('Fast Research');
});

test('normalizeSearchMode preserves valid search modes', () => {
  expect(normalizeSearchMode('Fast Research')).toBe('Fast Research');
  expect(normalizeSearchMode('Deep Research')).toBe('Deep Research');
});

test('splitUploadFiles separates supported and unsupported files', () => {
  const supportedFile = new File(['content'], 'notes.pdf', { type: 'application/pdf' });
  const unsupportedFile = new File(['content'], 'archive.zip', { type: 'application/zip' });

  const { supported, unsupported } = splitUploadFiles([supportedFile, unsupportedFile]);

  expect(supported).toEqual([supportedFile]);
  expect(unsupported).toEqual([unsupportedFile]);
});
