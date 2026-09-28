import { beforeEach, expect, test } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '../../test-utils/msw/server';
import { TestProviders } from '../../test-utils/providers';
import LabCanvasSettings from './LabCanvasSettings';

// covers: r117
// 画布偏好（方向 / 布局算法 / 连线 / 小地图）仅存客户端状态：
// 切换偏好时 MUST NOT 发出任何修改 research graph 的服务端请求。

const recordedRequests: string[] = [];

beforeEach(() => {
  recordedRequests.length = 0;
  // Catch-all recorder: any request the component triggers is captured here.
  server.use(
    http.all('*', ({ request }) => {
      recordedRequests.push(`${request.method} ${request.url}`);
      return HttpResponse.json(null, { status: 404 });
    }),
  );
});

function renderSettings() {
  const calls = {
    onDirection: (d: 'TB' | 'LR') => calls.directions.push(d),
    onAlgorithm: (a: string) => calls.algorithms.push(a),
    onEdgePathPreset: (p: string) => calls.edgePaths.push(p),
    onShowMiniMap: (v: boolean) => calls.miniMap.push(v),
    directions: [] as string[],
    algorithms: [] as string[],
    edgePaths: [] as string[],
    miniMap: [] as boolean[],
  };
  render(
    <TestProviders>
      <LabCanvasSettings
        direction="TB"
        onDirection={calls.onDirection}
        algorithm="layered"
        onAlgorithm={calls.onAlgorithm}
        edgePathPreset="smoothstep"
        onEdgePathPreset={calls.onEdgePathPreset}
        showMiniMap={false}
        onShowMiniMap={calls.onShowMiniMap}
      />
    </TestProviders>,
  );
  return calls;
}

test('toggling every canvas preference fires only client callbacks and zero requests', () => {
  const calls = renderSettings();

  // Open the settings panel.
  fireEvent.click(screen.getByText('画布'));

  // Direction → LR
  fireEvent.click(screen.getByTitle('左右布局（LR）'));
  // Layout algorithm → force
  fireEvent.click(screen.getByTitle('elk.force · 力导向'));
  // Edge path → straight
  fireEvent.click(screen.getByTitle('straight · 直线'));
  // Mini map → show
  fireEvent.click(screen.getByTitle('显示小地图'));

  expect(calls.directions).toEqual(['LR']);
  expect(calls.algorithms).toEqual(['force']);
  expect(calls.edgePaths).toEqual(['straight']);
  expect(calls.miniMap).toEqual([true]);

  // No network request of any kind (graph command ports included) was sent.
  expect(recordedRequests).toEqual([]);
});
