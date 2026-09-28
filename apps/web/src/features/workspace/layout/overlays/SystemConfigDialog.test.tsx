import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { toast } from '../../../../shared/toast';
import { server } from '../../../../test-utils/msw/server';
import { TestProviders } from '../../../../test-utils/providers';
import SystemConfigDialog from './SystemConfigDialog';

function SwrWrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

let toastSuccessSpy: ReturnType<typeof rs.spyOn>;

beforeEach(() => {
  // Mock reason: suppress visual toast side effects while asserting notification calls.
  toastSuccessSpy = rs.spyOn(toast, 'success').mockImplementation(() => {});
  rs.spyOn(toast, 'error').mockImplementation(() => {});
  rs.spyOn(toast, 'info').mockImplementation(() => {});
  rs.spyOn(toast, 'warning').mockImplementation(() => {});
});

function presetFixture(id: number, trigger: string, enabled = true) {
  return {
    id,
    trigger,
    description: `${trigger} 描述`,
    systemPrompt: `${trigger} system prompt`,
    enabled,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  };
}

test('renders /prompt preset entries from the presets endpoint', async () => {
  server.use(http.get('*/v2/prompt-presets', () => HttpResponse.json([presetFixture(3, 'demo')])));

  render(
    <TestProviders>
      <SwrWrapper>
        <SystemConfigDialog open={true} onClose={rs.fn()} />
      </SwrWrapper>
    </TestProviders>,
  );

  expect(await screen.findByText('/prompt:demo')).toBeInTheDocument();
  expect(screen.getByText('demo 描述')).toBeInTheDocument();
});

// covers: r402
test('creates a custom /prompt preset via the system config dialog', async () => {
  let createdBody: Record<string, unknown> | null = null;
  server.use(
    http.get('*/v2/prompt-presets', () => HttpResponse.json([])),
    http.post('*/v2/prompt-presets', async ({ request }) => {
      createdBody = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(presetFixture(9, 'summarize'));
    }),
  );

  render(
    <TestProviders>
      <SwrWrapper>
        <SystemConfigDialog open={true} onClose={rs.fn()} />
      </SwrWrapper>
    </TestProviders>,
  );

  fireEvent.click(await screen.findByText('新建预设'));

  const triggerInput = screen.getByPlaceholderText('demo');
  fireEvent.change(triggerInput, { target: { value: 'Summarize' } });
  fireEvent.change(screen.getByPlaceholderText('一句话说明这个 preset 的用途…'), {
    target: { value: '总结模式' },
  });
  fireEvent.change(screen.getByPlaceholderText('写入将覆盖 QA 的 system message 的内容…'), {
    target: { value: 'You are a summarizer.' },
  });
  expect(screen.getByRole('checkbox')).toBeChecked();

  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  await waitFor(() => {
    expect(createdBody).toEqual({
      trigger: 'summarize',
      description: '总结模式',
      systemPrompt: 'You are a summarizer.',
      enabled: true,
    });
  });
  expect(toastSuccessSpy).toHaveBeenCalledWith('已创建预设');
});

// covers: r402
test('toggles preset enabled state and deletes a preset with confirm', async () => {
  server.use(
    http.get('*/v2/prompt-presets', () => HttpResponse.json([presetFixture(5, 'demo')])),
    http.patch('*/v2/prompt-presets/:id', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(presetFixture(5, 'demo', Boolean(body.enabled)));
    }),
    http.delete('*/v2/prompt-presets/:id', () => HttpResponse.json({})),
  );

  render(
    <TestProviders>
      <SwrWrapper>
        <SystemConfigDialog open={true} onClose={rs.fn()} />
      </SwrWrapper>
    </TestProviders>,
  );

  expect(await screen.findByText('/prompt:demo')).toBeInTheDocument();

  // 启用状态 CRUD
  const enableCheckbox = screen.getByRole('checkbox');
  expect(enableCheckbox).toBeChecked();
  fireEvent.click(enableCheckbox);

  await waitFor(() => {
    expect(screen.getByText('已禁用')).toBeInTheDocument();
  });

  // 删除走确认 popover
  fireEvent.click(screen.getByText('删除'));
  fireEvent.click(await screen.findByTestId('confirm-popover-confirm'));

  await waitFor(() => {
    expect(toastSuccessSpy).toHaveBeenCalledWith('已删除预设');
  });
  await waitFor(() => {
    expect(screen.queryByText('/prompt:demo')).not.toBeInTheDocument();
  });
});
