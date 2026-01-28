import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import SlidesStudioDialog from './SlidesStudioDialog';
import { getSlidesConfig } from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    getSlidesConfig: vi.fn(),
  };
});

function renderDialog(overrides: Partial<ComponentProps<typeof SlidesStudioDialog>> = {}) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SlidesStudioDialog
        open
        onClose={() => {}}
        notebookId={1}
        selectedChunkIds={[]}
        isConnected
        onOutputsUpdated={() => {}}
        openMode="config"
        {...overrides}
      />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('renders slides config options from backend', async () => {
  vi.mocked(getSlidesConfig).mockResolvedValue({
    defaults: {
      quantity: 'standard',
      audience: 'general',
      structure: 'standard',
      tone: 'professional',
      language: 'zh',
      density: 'standard',
      theme_preset: 'minimal-clean',
      frontmatter: '',
    },
    quantity_options: [
      { id: 'short', label: '精简', is_default: false },
      { id: 'standard', label: '标准', is_default: true },
    ],
    audience_options: [{ id: 'general', label: '通用受众', is_default: true }],
    structure_options: [{ id: 'standard', label: '通用结构', is_default: true }],
    tone_options: [{ id: 'professional', label: '正式专业', is_default: true }],
    language_options: [{ id: 'zh', label: '中文', is_default: true }],
    density_options: [{ id: 'standard', label: '标准', is_default: true }],
    theme_preset_options: [
      {
        id: 'minimal-clean',
        label: '清爽极简',
        template: { theme: 'default', transition: 'fade', background: '#fff' },
      },
    ],
  });

  renderDialog();
  expect(await screen.findByText('精简')).toBeInTheDocument();

  const advancedButton = screen.getByRole('button', { name: '高级设置' });
  await userEvent.click(advancedButton);

  expect(await screen.findByText(/transition: "fade"/)).toBeInTheDocument();
});

test('shows backend unavailable message when disconnected', () => {
  renderDialog({ isConnected: false });
  expect(screen.getByText('未连接到后端服务。')).toBeInTheDocument();
  expect(getSlidesConfig).not.toHaveBeenCalled();
});
