import { afterEach, beforeEach, expect, test, rs } from '@rstest/core';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { TestProviders } from '../../../../test-utils/providers';
import { useWorkspaceStore } from '../../shared/state/workspaceStore';
import type { FrontendBundleDescriptor, OutputItem, RenderDescriptor } from '../../shared/types';
import OutputContent from './OutputContent';
import { useExport } from './useExport';

// Mock reason: isolate OutputContent menu/dispatch behavior from export implementation side effects.
rs.mock('./useExport', () => ({
  useExport: rs.fn(),
}));

let resolveBundleModule: ((value: { render: () => ReactNode }) => void) | null = null;
let rejectBundleModule: ((error: unknown) => void) | null = null;
let bundleModulePromise: Promise<{ render: () => ReactNode }> | null = null;

// Mock reason: avoid relying on actual dynamic imports in unit tests.
rs.mock('../../../../plugins/official/registry', () => ({
  getBuiltinBundleLoader: (id: string) => {
    if (id !== 'output-quiz') return null;
    if (!bundleModulePromise) {
      bundleModulePromise = new Promise((resolve, reject) => {
        resolveBundleModule = resolve;
        rejectBundleModule = reject;
      });
    }
    return () => bundleModulePromise!;
  },
}));

const useExportMock = rs.mocked(useExport);

function createOutput(type: OutputItem['type'], content: Record<string, unknown>): OutputItem {
  return {
    id: 1,
    type,
    prompt: `${type} prompt`,
    chunkIds: [1],
    content,
    contentLoaded: true,
    createdAt: '2026-01-01 10:00',
    updatedAt: '2026-01-01 10:00',
  };
}

/** STRUCTURED has no dedicated viewer branch in OutputContent — ideal for
 * renderDescriptor / Raw JSON fallback assertions (r462). */
const STRUCTURED_DESCRIPTOR: RenderDescriptor = {
  layout: 'list',
  itemSchema: { fields: [{ key: 'text', type: 'text', label: 'Point', children: [] }] },
  options: { itemsKey: 'bullets' },
};

const STRUCTURED_CONTENT = { title: 'S', bullets: [{ text: 'Alpha' }, { text: 'Beta' }] };

beforeEach(() => {
  resolveBundleModule = null;
  rejectBundleModule = null;
  bundleModulePromise = null;

  useExportMock.mockReturnValue({
    isExporting: false,
    activeFormat: null,
    getSupportedFormats: () => ['markdown'],
    exportOutput: rs.fn(),
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
    render(
      <TestProviders>
        <OutputContent output={output} />
      </TestProviders>,
    );
  });

  await act(async () => {
    // Allow effects to run and request the bundle loader.
    await Promise.resolve();
    resolveBundleModule?.({ render: () => <div>BUNDLE_RENDERED</div> });
    await bundleModulePromise;
  });

  expect(screen.getByText('BUNDLE_RENDERED')).toBeInTheDocument();
});

test('unsupported bundle apiVersion skips the bundle and falls back to renderDescriptor (r462)', async () => {
  useWorkspaceStore.getState().setOutputTypeRenderDescriptors({
    STRUCTURED: STRUCTURED_DESCRIPTOR,
  });
  useWorkspaceStore.getState().setOutputTypeFrontendBundles({
    STRUCTURED: {
      // 非 v1 的 apiVersion MUST 被拒载 — 回退 renderDescriptor 通用渲染。
      // (wire 类型目前仅声明 'v1'；故意注入未来版本验证 OutputContent 守卫。)
      apiVersion: 'v9',
      kind: 'builtin',
      id: 'output-quiz',
      export: 'render',
      meta: {},
    } as unknown as FrontendBundleDescriptor,
  });

  const output = createOutput('STRUCTURED', STRUCTURED_CONTENT);
  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  // GenericOutputRenderer（renderDescriptor 驱动）接管渲染。
  expect(screen.getAllByText('Point')).toHaveLength(2);
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.queryByText('BUNDLE_RENDERED')).toBeNull();
});

test('broken bundle module (load rejection) falls back to renderDescriptor (r462)', async () => {
  // DEV-guarded console.warn in OutputContent — spy keeps expected noise out of CI output.
  const warn = rs.spyOn(console, 'warn').mockImplementation(() => {});
  useWorkspaceStore.getState().setOutputTypeRenderDescriptors({
    STRUCTURED: STRUCTURED_DESCRIPTOR,
  });
  useWorkspaceStore.getState().setOutputTypeFrontendBundles({
    STRUCTURED: {
      apiVersion: 'v1',
      kind: 'builtin',
      id: 'output-quiz',
      export: 'render',
      meta: {},
    },
  });

  const output = createOutput('STRUCTURED', STRUCTURED_CONTENT);
  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  await act(async () => {
    await Promise.resolve();
    rejectBundleModule?.(new Error('bundle chunk failed to parse'));
  });

  // 加载失败被 .catch 吸收：回退 renderDescriptor 通用渲染而非崩溃。
  expect(screen.getAllByText('Point')).toHaveLength(2);
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.queryByText('BUNDLE_RENDERED')).toBeNull();
  warn.mockRestore();
});

test('without renderDescriptor the broken-bundle path ends at the Raw JSON fallback (r462)', async () => {
  const warn = rs.spyOn(console, 'warn').mockImplementation(() => {});
  useWorkspaceStore.getState().setOutputTypeFrontendBundles({
    STRUCTURED: {
      apiVersion: 'v1',
      kind: 'builtin',
      id: 'output-quiz',
      export: 'render',
      meta: {},
    },
  });

  const output = createOutput('STRUCTURED', { title: 'Raw', bullets: [] });
  render(
    <TestProviders>
      <OutputContent output={output} />
    </TestProviders>,
  );

  await act(async () => {
    await Promise.resolve();
    rejectBundleModule?.(new Error('bundle chunk failed to parse'));
  });

  // 最终安全回退：Raw JSON。
  expect(screen.getByText(/"title": "Raw"/)).toBeInTheDocument();
  warn.mockRestore();
});
