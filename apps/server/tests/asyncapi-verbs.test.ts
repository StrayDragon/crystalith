import { describe, expect, it } from 'bun:test';

import { generateAsyncApiDocument } from '../src/asyncapi.ts';

describe('c70 AsyncAPI stream verbs', () => {
  it('documents QA/studio GET with nested paths', () => {
    const doc = generateAsyncApiDocument() as {
      channels: Record<string, { address: string; bindings?: { http?: { method?: string } } }>;
    };

    expect(doc.channels.qaStream.address).toBe('/v2/notebooks/{nid}/qa/stream');
    expect(doc.channels.qaStream.bindings?.http?.method).toBe('POST');

    expect(doc.channels.studioOutlineStream.address).toBe(
      '/v2/notebooks/{nid}/studio/slides/{id}/outline/stream',
    );
    expect(doc.channels.studioOutlineStream.bindings?.http?.method).toBe('GET');

    expect(doc.channels.studioMarkdownStream.address).toBe(
      '/v2/notebooks/{nid}/studio/slides/{id}/markdown/stream',
    );
    expect(doc.channels.studioMarkdownStream.bindings?.http?.method).toBe('GET');
  });
});
