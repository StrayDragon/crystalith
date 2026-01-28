import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';

import type SlidesStudioDialog from './SlidesStudioDialog';
import { getSlidesConfig } from '../api';

const swrState = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  isLoading: false,
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');
  return {
    ...actual,
    default: (key: string | null) => ({
      data: key ? swrState.data : undefined,
      error: swrState.error,
      isLoading: swrState.isLoading,
    }),
  };
});

vi.mock('./ModelSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="model-selector" />,
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock('@material-tailwind/react', async () => {
  const actual = await vi.importActual<typeof import('@material-tailwind/react')>('@material-tailwind/react');
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
  };
});

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    getSlidesConfig: vi.fn(),
  };
});

type SlidesStudioDialogProps = ComponentProps<typeof SlidesStudioDialog>;

async function renderDialog(overrides: Partial<SlidesStudioDialogProps> = {}) {
  const { default: SlidesStudioDialogComponent } = await import('./SlidesStudioDialog');
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SlidesStudioDialogComponent
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
  swrState.data = null;
  swrState.error = null;
  swrState.isLoading = false;
});

test('renders slides config options from backend', async () => {
  swrState.data = {
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
  };

  await renderDialog();
  expect(await screen.findByText('精简')).toBeInTheDocument();

  const advancedButton = screen.getByRole('button', { name: '高级设置' });
  await userEvent.click(advancedButton);

  expect(await screen.findByText(/transition: "fade"/)).toBeInTheDocument();
});

test('shows backend unavailable message when disconnected', async () => {
  await renderDialog({ isConnected: false });
  expect(screen.getByText('未连接到后端服务。')).toBeInTheDocument();
  expect(getSlidesConfig).not.toHaveBeenCalled();
});
