import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { OutputItem } from '../../shared/types';
import OutputContent from './OutputContent';
import { useExport } from './useExport';

// Mock reason: isolate OutputContent menu/dispatch behavior from export implementation side effects.
vi.mock('./useExport', () => ({
  useExport: vi.fn(),
}));

let resolveBundleModule: ((value: { render: () => ReactNode }) => void) | null = null;
let bundleModulePromise: Promise<{ render: () => ReactNode }> | null = null;

// Mock reason: avoid relying on actual dynamic imports in unit tests.
vi.mock('../../../../plugins/official/registry', () => ({
  getBuiltinBundleLoader: (id: string) => {
    if (id !== 'output-quiz') return null;
    if (!bundleModulePromise) {
      bundleModulePromise = new Promise((resolve) => {
        resolveBundleModule = resolve;
      });
    }
    return () => bundleModulePromise!;
  },
}));

const useExportMock = vi.mocked(useExport);

function createOutput(type: OutputItem['type'], content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

beforeEach(() => {
  resolveBundleModule = null;
  bundleModulePromise = null;

  useExportMock.mockReturnValue({
    isExporting: false,
    activeFormat: null,
    getSupportedFormats: () => ['markdown'],
    exportOutput: vi.fn(),
  });

  useWorkspaceStore.getState().setOutputTypeRenderDescriptors({});
  useWorkspaceStore.getState().setOutputTypeFrontendBundles({});
});

afterEach(async () => {
  await act(async () => {
    useWorkspaceStore.getState().setOutputTypeRenderDescriptors({});
    useWorkspaceStore.getState().setOutputTypeFrontendBundles({});
  });
});

test('renders with frontendBundle renderer when available', async () => {
  useWorkspaceStore.getState().setOutputTypeFrontendBundles({
    QUIZ: {
      apiVersion: 'v1',
      kind: 'builtin',
      id: 'output-quiz',
      export: 'render',
      meta: {},
    },
  });

  const output = createOutput('QUIZ', {
    questions: [{ question: '2+2?', options: ['3', '4'], answer: '4' }],
  });

  await act(async () => {
    render(<OutputContent output={output} />);
  });

  await act(async () => {
    // Allow effects to run and request the bundle loader.
    await Promise.resolve();
    resolveBundleModule?.({ render: () => <div>BUNDLE_RENDERED</div> });
    await bundleModulePromise;
  });

  expect(screen.getByText('BUNDLE_RENDERED')).toBeInTheDocument();
});
