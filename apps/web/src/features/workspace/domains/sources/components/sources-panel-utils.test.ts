import { expect, test } from '@rstest/core';

import { formatSnapshotTimestamp } from './source-connector-utils';
import { splitUploadFiles } from './sources-panel-utils';

test('splitUploadFiles separates supported and unsupported files', () => {
  const supportedFile = new File(['content'], 'notes.pdf', { type: 'application/pdf' });
  const unsupportedFile = new File(['content'], 'archive.zip', { type: 'application/zip' });

  const { supported, unsupported } = splitUploadFiles([supportedFile, unsupportedFile]);

  expect(supported).toEqual([supportedFile]);
  expect(unsupported).toEqual([unsupportedFile]);
});

test('formatSnapshotTimestamp accepts Eden Date coercion and strings', () => {
  expect(formatSnapshotTimestamp('2024-01-01T00:00:00.000Z')).toBe('2024-01-01T00:00:00.000Z');
  expect(formatSnapshotTimestamp(new Date('2024-01-01T00:00:00.000Z'))).toBe(
    '2024-01-01T00:00:00.000Z',
  );
  expect(formatSnapshotTimestamp(null)).toBe('');
});
