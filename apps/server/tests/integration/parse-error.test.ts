// covers: r346（workspace-api-contract）——非 SSE 错误统一信封：无法解析的请求体
// 也 MUST 以 ErrorEnvelope 形状返回（400 INVALID_REQUEST），而非裸 500 兜底。
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { createApp } from '../../src/server.ts';
import { setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';

beforeAll(() => {
  setupIntegrationEnv();
});

afterAll(teardownIntegrationEnv);

describe('malformed JSON body → 400', () => {
  it('returns INVALID_REQUEST envelope for unparseable JSON', async () => {
    const app = createApp();
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name": "unterminated',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode?: string; message?: string };
    expect(body.errorCode).toBe('INVALID_REQUEST');
    expect(typeof body.message).toBe('string');
  });
});
