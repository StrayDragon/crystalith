import { describe, expect, it } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { Button, Chip, IconButton, Spinner, Typography } from './index';

describe('shared/ui primitives', () => {
  it('renders Button variants and forwards testid / disabled / ref', () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = () => undefined;
    render(
      <Button ref={ref} variant="outlined" data-testid="ui-btn" disabled onClick={onClick}>
        保存
      </Button>,
    );
    const btn = screen.getByTestId('ui-btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toBe('保存');
    expect(ref.current).toBe(btn);
    fireEvent.click(btn);
  });

  it('renders Typography small as p and passes className', () => {
    render(
      <Typography variant="small" className="text-xs" data-testid="ui-typo">
        说明
      </Typography>,
    );
    const node = screen.getByTestId('ui-typo');
    expect(node.tagName).toBe('P');
    expect(node.className).toContain('text-xs');
    expect(node.textContent).toBe('说明');
  });

  it('renders IconButton text variant', () => {
    render(
      <IconButton variant="text" size="sm" data-testid="ui-icon" aria-label="关闭">
        x
      </IconButton>,
    );
    expect(screen.getByTestId('ui-icon').getAttribute('aria-label')).toBe('关闭');
  });

  it('renders Spinner with size class override', () => {
    const { container } = render(<Spinner className="h-3 w-3" data-testid="ui-spin" />);
    const svg = screen.getByTestId('ui-spin');
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('class')).toContain('h-3');
    expect(container.querySelector('svg')).toBe(svg);
  });

  it('renders Chip from value and hides when open is false', () => {
    const { rerender } = render(<Chip value="就绪" size="sm" variant="ghost" color="green" />);
    expect(screen.getByText('就绪')).toBeTruthy();
    rerender(<Chip value="就绪" open={false} />);
    expect(screen.queryByText('就绪')).toBeNull();
  });
});
