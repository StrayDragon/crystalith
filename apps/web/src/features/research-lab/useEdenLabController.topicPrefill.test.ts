// covers: r459（deep-research-ui）——?topic= 打开 Lab 时 Compose topic 预填且不立即创建 ResearchRun。
import { afterEach, beforeEach, describe, expect, it } from '@rstest/core';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { renderHook } from '../../test-utils/renderHook';
import { useEdenLabController } from './useEdenLabController';

const NID = 8241; // 文件内唯一 notebookId
const TOPIC = '量子纠错路线图';

let createCalls = 0;

beforeEach(() => {
  createCalls = 0;
  // 带 topic 的深研 slash 确认发送 → 导航到 /research-lab/:nid?topic=…（无 rid）。
  window.history.replaceState(null, '', `/research-lab/${NID}?topic=${encodeURIComponent(TOPIC)}`);
  // 显式计数创建口调用（场景断言「不立即创建 ResearchRun」）；其余未 mock 请求在
  // RSTEST_MSW_ON_UNHANDLED=error 下即测试失败。
  server.use(
    http.post(`*/v2/notebooks/${NID}/research`, () => {
      createCalls += 1;
      return HttpResponse.json({});
    }),
  );
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useEdenLabController ?topic= compose prefill (r459)', () => {
  it('prefills topicDraft from ?topic= without creating a run', async () => {
    const { result } = renderHook(() => useEdenLabController(NID));

    // Compose topic 预填：LabComposePanel draft.topic ← lab.topicDraft。
    await waitFor(() => {
      expect(result.current.topicDraft).toBe(TOPIC);
    });

    // one-shot 消费：URL 中的 topic 参数读取后被清除。
    expect(new URL(window.location.href).searchParams.get('topic')).toBeNull();

    // 不立即创建 ResearchRun：无 Run 挂载、无 POST …/research。
    expect(result.current.runId).toBeNull();
    expect(result.current.runStatus).toBeNull();
    expect(createCalls).toBe(0);
  });
});
