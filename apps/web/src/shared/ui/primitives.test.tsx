import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { Button, Chip } from './index';

// 保留两条有行为语义的用例（Button 的 ref/disabled API 契约、Chip 的 open
// 开关逻辑）；Typography/IconButton/Spinner 的纯 prop 镜像用例已删。
describe('shared/ui primitives', () => {
  it('renders Button variants and forwards testid / disabled / ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} variant="outlined" data-testid="ui-btn" disabled>
        保存
      </Button>,
    );
    const btn = screen.getByTestId('ui-btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toBe('保存');
    expect(ref.current).toBe(btn);
  });

  it('renders Chip from value and hides when open is false', () => {
    const { rerender } = render(<Chip value="就绪" size="sm" variant="ghost" color="green" />);
    expect(screen.getByText('就绪')).toBeTruthy();
    rerender(<Chip value="就绪" open={false} />);
    expect(screen.queryByText('就绪')).toBeNull();
  });
});
