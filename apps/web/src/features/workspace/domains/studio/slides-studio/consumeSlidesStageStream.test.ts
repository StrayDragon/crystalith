import { describe, expect, it, vi } from 'vitest';

import { consumeSlidesStageStream, slidesStageStreamPath } from './consumeSlidesStageStream';

describe('consumeSlidesStageStream (c70 GET SSE)', () => {
  it('builds nested stream paths', () => {
    expect(slidesStageStreamPath(2, 9, 'outline')).toBe(
      '/v2/notebooks/2/studio/slides/9/outline/stream',
    );
    expect(slidesStageStreamPath(2, 9, 'markdown')).toBe(
      '/v2/notebooks/2/studio/slides/9/markdown/stream',
    );
  });

  it('resolves on done and forwards progress events', async () => {
    // Mock reason: stub fetch to assert GET SSE path/verb without a live server.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          'event: progress\ndata: {"message":"开始"}\n\nevent: done\ndata: {"slideId":1}\n\n',
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const events: string[] = [];
    await consumeSlidesStageStream(1, 1, 'outline', {
      onEvent: (e) => events.push(e.event),
    });

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v2/notebooks/1/studio/slides/1/outline/stream');
    expect(init.method ?? 'GET').toBe('GET');
    expect(events).toEqual(['progress', 'done']);

    vi.unstubAllGlobals();
  });

  it('throws on error event', async () => {
    // Mock reason: stub fetch SSE error event without spinning up studio pipeline.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('event: error\ndata: {"message":"boom"}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    await expect(consumeSlidesStageStream(1, 1, 'markdown')).rejects.toThrow('boom');
    vi.unstubAllGlobals();
  });
});
