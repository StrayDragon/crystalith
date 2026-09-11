import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from './layer';
import { toast, ToastContainer, useToastStore } from './toast';

describe('toast action (c91 / r446)', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.setState({ toasts: [] });
    });
  });

  it('renders optional action and invokes onClick', () => {
    const onClick = rs.fn();
    render(
      <LayerProvider>
        <ToastContainer />
      </LayerProvider>,
    );

    act(() => {
      toast.success('已转为笔记 #42', {
        duration: 0,
        action: { label: '打开工作区', onClick },
      });
    });

    expect(screen.getByText('已转为笔记 #42')).toBeTruthy();
    const actionBtn = screen.getByTestId('toast-action');
    expect(actionBtn.textContent).toBe('打开工作区');
    fireEvent.click(actionBtn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('已转为笔记 #42')).toBeNull();
  });

  it('keeps duration-only API without action', () => {
    render(
      <LayerProvider>
        <ToastContainer />
      </LayerProvider>,
    );

    act(() => {
      toast.success('纯消息', 0);
    });
    expect(screen.getByText('纯消息')).toBeTruthy();
    expect(screen.queryByTestId('toast-action')).toBeNull();
  });
});
