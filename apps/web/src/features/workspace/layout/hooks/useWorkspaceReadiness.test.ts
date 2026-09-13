import { expect, test } from '@rstest/core';

import { computeWorkspaceReadiness } from './useWorkspaceReadiness';

test('computeWorkspaceReadiness: not connected (connecting)', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'connecting',
      connectionError: '',
      notebookId: null,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'not_connected', connectionState: 'connecting', error: '' });
});

test('computeWorkspaceReadiness: not connected (error)', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'error',
      connectionError: 'boom',
      notebookId: null,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'not_connected', connectionState: 'error', error: 'boom' });
});

test('computeWorkspaceReadiness: no notebook', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: null,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'no_notebook' });
});

test('computeWorkspaceReadiness: loading sources', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: 1,
      sourcesLoading: true,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'loading' });
});

test('computeWorkspaceReadiness: no session even when notebook has zero sources', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: 1,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'no_session', notebookId: 1 });
});

test('computeWorkspaceReadiness: loading sessions', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: 1,
      sourcesLoading: false,
      sessionsLoading: true,
      sessionId: null,
    }),
  ).toEqual({ kind: 'loading' });
});

test('computeWorkspaceReadiness: no session', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: 1,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: null,
    }),
  ).toEqual({ kind: 'no_session', notebookId: 1 });
});

test('computeWorkspaceReadiness: ready', () => {
  expect(
    computeWorkspaceReadiness({
      connectionState: 'live',
      connectionError: '',
      notebookId: 1,
      sourcesLoading: false,
      sessionsLoading: false,
      sessionId: 99,
    }),
  ).toEqual({ kind: 'ready', notebookId: 1 });
});
