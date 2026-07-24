import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LayerProvider } from '../../shared/layer';
import LabProgressBar from './LabProgressBar';
import type { LabProgressLedgerItem } from './labProgressLedger';

afterEach(() => cleanup());

const events: LabProgressLedgerItem[] = [
  {
    id: '1',
    seq: 1,
    at: '2026-07-24T08:00:01.000Z',
    kind: 'run_running',
    headline: '开始研究',
  },
  {
    id: '2',
    seq: 2,
    at: '2026-07-24T08:00:05.000Z',
    kind: 'unit_started',
    nodeId: 'node_abc',
    headline: '研究支路：性能',
  },
];

describe('LabProgressBar ledger (c95)', () => {
  it('shows real pct and expandable ledger timeline', () => {
    render(
      <LayerProvider>
        <LabProgressBar
          phase="explore"
          progressPct={42}
          searchesUsed={8}
          maxSearches={20}
          researchDone={1}
          researchTotal={3}
          events={events}
        />
      </LayerProvider>,
    );
    expect(screen.getByTestId('research-lab-progress')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
    fireEvent.click(screen.getByTitle('点击查看进度账本'));
    const ledger = screen.getByTestId('research-lab-progress-ledger');
    expect(ledger).toBeTruthy();
    expect(ledger.textContent).toContain('8/20');
    expect(ledger.textContent).toContain('1/3');
    expect(ledger.textContent).toContain('研究支路：性能');
  });

  it('clicking nodeId selects graph node', () => {
    const onSelect = vi.fn();
    render(
      <LayerProvider>
        <LabProgressBar
          phase="explore"
          progressPct={10}
          searchesUsed={1}
          maxSearches={20}
          researchDone={0}
          researchTotal={2}
          events={events}
          onSelectNodeId={onSelect}
        />
      </LayerProvider>,
    );
    fireEvent.click(screen.getByTitle('点击查看进度账本'));
    fireEvent.click(screen.getByRole('button', { name: 'node_abc' }));
    expect(onSelect).toHaveBeenCalledWith('node_abc');
  });
});
