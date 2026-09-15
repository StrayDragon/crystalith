/**
 * c64 / r13: stream interruption banner — reconnecting (N/M) state and
 * exhausted state with manual retry entry.
 */
import { describe, expect, it, rs } from '@rstest/core';
import { fireEvent, render, screen } from '@testing-library/react';

import { LayerProvider } from '../../shared/layer';
import { TestIds } from '../../shared/testids';
import { LabStreamBanner } from './LabStreamBanner';

function renderBanner(props: {
  streamState: 'ok' | 'reconnecting' | 'exhausted';
  streamAttempt: number;
  retryStream: () => void;
}) {
  return render(
    <LayerProvider>
      <LabStreamBanner {...props} />
    </LayerProvider>,
  );
}

describe('LabStreamBanner (c64 / r13)', () => {
  it('renders nothing while connected', () => {
    const { container } = renderBanner({
      streamState: 'ok',
      streamAttempt: 0,
      retryStream: () => undefined,
    });
    expect(container.textContent).toBe('');
  });

  it('shows reconnecting state with attempt counter', () => {
    renderBanner({
      streamState: 'reconnecting',
      streamAttempt: 2,
      retryStream: () => undefined,
    });
    const banner = screen.getByTestId(TestIds.researchLabStreamReconnecting);
    expect(banner.textContent).toContain('连接中断，正在重连');
    expect(banner.textContent).toContain('2/5');
  });

  it('exhausted state offers manual retry and triggers it on click', () => {
    const retried = rs.fn();
    renderBanner({ streamState: 'exhausted', streamAttempt: 5, retryStream: retried });
    const banner = screen.getByTestId(TestIds.researchLabStreamExhausted);
    expect(banner.textContent).toContain('连接已断开');

    fireEvent.click(screen.getByTestId(TestIds.researchLabStreamRetry));
    expect(retried).toHaveBeenCalledTimes(1);
  });
});
