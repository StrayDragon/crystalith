/**
 * Deep Research runtime — thin barrel re-exporting the public API.
 */
export type { SseEmit } from './research-core.ts';
export { isPruneProtectedNode, subscribeRun } from './research-core.ts';
export { scheduleRun } from './run-loop.ts';
export {
  // oxlint-disable-next-line typescript/no-deprecated -- fixture-only stub; retained for isolated tests
  synthesizeReport,
  retrySynthesize,
  listProgress,
  getReportView,
  putCanonicalReport,
  putWorkingReport,
  deleteWorkingReport,
} from './report.ts';
export {
  listRevisions,
  getRevision,
  createRevision,
  restoreRevision,
  forkRunFromRevision,
} from './report-revisions.ts';
export {
  validateCreateBody,
  createRun,
  listRuns,
  getRun,
  scheduleQueuedRun,
  cancelRun,
  confirmRun,
  addBudget,
  collectResearchPruneClosure,
  pruneNode,
  patchNode,
  forkNode,
  requestReexpand,
  convertToNote,
  convertToSource,
  streamRun,
  createResearchSseResponse,
} from './commands.ts';
export { createNodeChatSseResponse } from './node-chat.ts';
