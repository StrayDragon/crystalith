import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import ErrorBoundary from './ErrorBoundary';

function CrashComponent() {
  throw new Error('boom');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('error boundary shows fallback and supports retry action', () => {
  const onRetry = vi.fn();

  render(
    <ErrorBoundary
      title="对话面板异常"
      description="对话面板渲染失败，请重试。"
      onRetry={onRetry}
    >
      <CrashComponent />
    </ErrorBoundary>,
  );

  expect(screen.getByText('对话面板异常')).toBeInTheDocument();
  const retryButton = screen.getByRole('button', { name: '重试' });
  fireEvent.click(retryButton);
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('error boundary keeps other panels visible when one panel crashes', () => {
  render(
    <div>
      <ErrorBoundary title="对话面板异常" description="对话面板渲染失败，请重试。">
        <CrashComponent />
      </ErrorBoundary>
      <ErrorBoundary>
        <div>Sources Panel Content</div>
      </ErrorBoundary>
      <ErrorBoundary>
        <div>Studio Panel Content</div>
      </ErrorBoundary>
    </div>,
  );

  expect(screen.getByText('对话面板异常')).toBeInTheDocument();
  expect(screen.getByText('Sources Panel Content')).toBeInTheDocument();
  expect(screen.getByText('Studio Panel Content')).toBeInTheDocument();
});
