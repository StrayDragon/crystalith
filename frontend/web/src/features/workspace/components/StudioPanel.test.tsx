import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import StudioPanel from './StudioPanel';
import type { WorkspaceTool } from '../types';

const baseTool: WorkspaceTool = {
  id: 'slides',
  label: '演示',
  description: '演示文稿',
  tone: 'slate',
  outputType: 'SLIDES',
  prompt: '生成演示大纲与 Slidev Markdown。',
  enabled: true,
};

function renderPanel(overrides: Partial<ComponentProps<typeof StudioPanel>> = {}) {
  const onOpenSlides = vi.fn();
  const onGenerateOutput = vi.fn();
  render(
    <StudioPanel
      tools={[baseTool]}
      outputs={[]}
      outputQueueJobs={[]}
      outputsLoading={false}
      outputsError=""
      onRetryOutputs={() => {}}
      onGenerateOutput={onGenerateOutput}
      onOpenSlides={onOpenSlides}
      onDeleteOutput={() => {}}
      onSelectOutput={() => {}}
      isDemo
      {...overrides}
    />,
  );
  return { onOpenSlides, onGenerateOutput };
}

test('slides card triggers auto generate flow', async () => {
  const { onOpenSlides, onGenerateOutput } = renderPanel();
  const label = screen.getByText('演示');
  const cardButton = label.closest('button');
  expect(cardButton).not.toBeNull();
  if (cardButton) {
    await userEvent.click(cardButton);
  }
  expect(onGenerateOutput).not.toHaveBeenCalled();
  expect(onOpenSlides).toHaveBeenCalledWith({ autoGenerate: true });
});

test('slides config icon opens settings mode', async () => {
  const { onOpenSlides } = renderPanel();
  const configButton = screen.getByLabelText('自定义工具参数');
  await userEvent.click(configButton);
  expect(onOpenSlides).toHaveBeenCalledWith({ autoGenerate: false });
});
