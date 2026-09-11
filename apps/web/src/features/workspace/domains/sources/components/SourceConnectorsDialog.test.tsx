import { beforeEach, expect, test, rs } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { toast } from '../../../../../shared/toast';
import { server } from '../../../../../test-utils/msw/server';
import { TestProvidersWithSWR } from '../../../../../test-utils/providers';
import SourceConnectorsDialog from './SourceConnectorsDialog';

const BINDING_ID = 77;
const CONNECTOR = {
  connectorId: 'local-dir',
  displayName: 'Local Directory',
  description: 'Import from a local folder',
  connectionConfigSchema: {},
  diagnostics: [],
  capabilities: { supportsSnapshot: true, supportsSyncCheck: false },
};

const BINDING = {
  id: BINDING_ID,
  notebookId: 1,
  connectorId: 'local-dir',
  connectionConfig: {},
  importScope: null,
  lastConfirmedSnapshot: null,
  lastSyncCheckResult: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  // Mock reason: suppress visual toast side effects while asserting notification calls.
  rs.spyOn(toast, 'success').mockImplementation(() => {});
  rs.spyOn(toast, 'error').mockImplementation(() => {});
  rs.spyOn(toast, 'warning').mockImplementation(() => {});
  rs.spyOn(toast, 'info').mockImplementation(() => {});
  // Mock reason: auto-confirm unbind dialog so the DELETE path is exercised in jsdom.
  rs.spyOn(window, 'confirm').mockReturnValue(true);
  rs.clearAllMocks();
});

test('unbind deletes binding and shows success toast', async () => {
  let deleteCalled = false;
  let deletePath = '';

  server.use(
    http.get('*/v2/notebooks/:notebookId/source-connectors', () =>
      HttpResponse.json({ connectors: [CONNECTOR] }),
    ),
    http.post('*/v2/notebooks/:notebookId/source-connectors/:connectorId/bindings', () =>
      HttpResponse.json(BINDING),
    ),
    http.post('*/v2/notebooks/:notebookId/source-connector-bindings/:bindingId/snapshot', () =>
      HttpResponse.json({
        generatedAt: '2024-01-01T00:00:00Z',
        entries: [
          {
            relativePath: 'note.md',
            sizeBytes: 12,
            // Eden may coerce this to Date; UI must not crash when rendering.
            modifiedAt: '2024-01-01T00:00:00Z',
            contentHash: 'abc',
          },
        ],
      }),
    ),
    http.delete('*/v2/source-connector-bindings/:id', ({ request }) => {
      deleteCalled = true;
      deletePath = new URL(request.url).pathname;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  render(
    <TestProvidersWithSWR>
      <SourceConnectorsDialog open onClose={rs.fn()} notebookId={1} isConnected />
    </TestProvidersWithSWR>,
  );

  await waitFor(() => {
    expect(screen.getByText('Local Directory')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('Local Directory'));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '创建绑定' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: '创建绑定' }));

  await waitFor(() => {
    expect(screen.getByTestId('sources-connectors-unbind')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId('sources-connectors-unbind'));

  await waitFor(() => {
    expect(deleteCalled).toBe(true);
  });
  expect(deletePath).toContain(`/v2/source-connector-bindings/${BINDING_ID}`);
  expect(toast.success).toHaveBeenCalledWith('已解除连接器绑定');
});
