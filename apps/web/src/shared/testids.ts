/**
 * Stable UI test identifiers (SSOT).
 *
 * Browser E2E and future RTL tests MUST prefer these over visible text.
 * Convention: domain-prefixed kebab-case (`chat-send`, `sources-add`).
 */
export const TestIds = {
  // Workspace shell
  workspaceRoot: 'ws-root',
  workspaceHeader: 'ws-header',
  connectionBanner: 'ws-connection-banner',
  connectionRetry: 'ws-connection-retry',
  onboardingBanner: 'ws-onboarding-banner',

  // Notebooks
  notebookSwitcherTrigger: 'notebook-switcher-trigger',
  notebookCreateButton: 'notebook-create-button',
  notebookSwitcherOverlay: 'notebook-switcher-overlay',
  notebookList: 'notebook-list',
  notebookOption: 'notebook-option',
  notebookCreateOverlay: 'notebook-create-overlay',

  // Layout / system
  layoutLockToggle: 'layout-lock-toggle',
  userMenuTrigger: 'user-menu-trigger',
  userMenuDiagnostics: 'user-menu-diagnostics',
  userMenuSystemConfig: 'user-menu-system-config',
  userMenuShortcutHelp: 'user-menu-shortcut-help',
  userMenuCommandPalette: 'user-menu-command-palette',
  commandPalette: 'command-palette',
  commandPaletteInput: 'command-palette-input',
  diagnosticsDialog: 'diagnostics-dialog',
  systemConfigDialog: 'system-config-dialog',
  shortcutHelp: 'shortcut-help',

  // Sources
  sourcesPanel: 'sources-panel',
  sourcesAdd: 'sources-add',
  sourcesUploadInput: 'sources-upload-input',
  sourcesConnectors: 'sources-connectors',
  sourcesConnectorsDialog: 'sources-connectors-dialog',
  sourcesConnectorsOption: 'sources-connectors-option',
  sourcesConnectorsNext: 'sources-connectors-next',
  sourcesConnectorsBack: 'sources-connectors-back',
  sourcesConnectorsCreateBinding: 'sources-connectors-create-binding',
  sourcesConnectorsUnbind: 'sources-connectors-unbind',
  sourcesConnectorsConfigField: 'sources-connectors-config-field',
  sourcesExtractorSettings: 'sources-extractor-settings',
  sourcesExtractorDialog: 'sources-extractor-dialog',
  sourcesSearchInput: 'sources-search-input',
  sourcesSearchSubmit: 'sources-search-submit',
  topbarSearchTrigger: 'topbar-search-trigger',
  topbarSearchPanel: 'topbar-search-panel',
  sourcesSortMenu: 'sources-sort-menu',
  sourcesSortMenuList: 'sources-sort-menu-list',
  sourcesCount: 'sources-count',
  sourcesEmpty: 'sources-empty',
  sourceRow: 'source-row',
  sourceRowCheckbox: 'source-row-checkbox',
  sourceDetailDialog: 'source-detail-dialog',
  sourceDetailClose: 'source-detail-close',
  sourceDetailTabSummary: 'source-detail-tab-summary',
  sourceDetailTabRaw: 'source-detail-tab-raw',
  sourcesSelectedMenu: 'sources-selected-menu',
  sourcesBatchDelete: 'sources-batch-delete',
  sourceRowMenu: 'source-row-menu',
  sourceRowDelete: 'source-row-delete',

  // Shared confirm popover
  confirmPopoverConfirm: 'confirm-popover-confirm',

  // URL import
  urlImportOpen: 'url-import-open',
  urlImportDialog: 'url-import-dialog',
  urlImportInput: 'url-import-input',
  urlImportModeLink: 'url-import-mode-link',
  urlImportModeFetch: 'url-import-mode-fetch',
  urlImportSubmit: 'url-import-submit',
  urlImportCancel: 'url-import-cancel',

  // Chat / sessions
  chatPanel: 'chat-panel',
  chatInput: 'chat-input',
  chatSend: 'chat-send',
  chatStop: 'chat-stop',
  chatMessageItem: 'chat-message-item',
  sessionSwitcherTrigger: 'session-switcher-trigger',
  sessionSwitcherOverlay: 'session-switcher-overlay',

  // Studio / notes
  studioPanel: 'studio-panel',
  studioAddNote: 'studio-add-note',
  studioGenerate: 'studio-generate',
  studioToolsPopover: 'studio-tools-popover',
  studioOutputItem: 'studio-output-item',
  noteEditorDialog: 'note-editor-dialog',
  slidesStudioDialog: 'slides-studio-dialog',
  slidesStudioClose: 'slides-studio-close',

  // Research Lab (fake demo / living design)
  researchLabPage: 'research-lab-page',
  researchLabEntry: 'research-lab-entry',
  researchLabBack: 'research-lab-back',
  researchLabProgress: 'research-lab-progress',
  researchLabProgressLedger: 'research-lab-progress-ledger',
  researchLabTopic: 'research-lab-topic',
  researchLabStart: 'research-lab-start',
  researchLabGraph: 'research-lab-graph',
  researchLabNodeDrawer: 'research-lab-node-drawer',
  researchLabLayoutTb: 'research-lab-layout-tb',
  researchLabLayoutLr: 'research-lab-layout-lr',
  researchLabLayoutAlgorithm: 'research-lab-layout-algorithm',
  researchLabEdgePathPresets: 'research-lab-edge-path-presets',
  researchLabReport: 'research-lab-report',
  researchLabReportPage: 'research-lab-report-page',
  researchLabReportChat: 'research-lab-report-chat',
  researchLabReportEdit: 'research-lab-report-edit',
  researchLabReportDoneEdit: 'research-lab-report-done-edit',
  researchLabReportViewCanonical: 'research-lab-report-view-canonical',
  researchLabReportDiscard: 'research-lab-report-discard',
  researchLabCanvasSettings: 'research-lab-canvas-settings',
  researchLabConsole: 'research-lab-console',
  researchLabConsoleDrag: 'research-lab-console-drag',
  researchLabChat: 'research-lab-chat',
  researchLabChatInput: 'research-lab-chat-input',
  researchLabChatSend: 'research-lab-chat-send',
  researchLabChatAction: 'research-lab-chat-action',
  researchLabChatActionAccept: 'research-lab-chat-action-accept',
  researchLabChatActionDismiss: 'research-lab-chat-action-dismiss',
  researchLabChatQuickAction: 'research-lab-chat-quick-action',
  researchLabExportSuggested: 'research-lab-export-suggested',
  researchLabRevisionSelect: 'research-lab-revision-select',
  researchLabRevisionSave: 'research-lab-revision-save',
  researchLabRevisionApplyGraph: 'research-lab-revision-apply-graph',
  researchLabForkDialog: 'research-lab-fork-dialog',
  researchLabPruneDialog: 'research-lab-prune-dialog',
  researchLabPruneCancel: 'research-lab-prune-cancel',
  researchLabPruneConfirm: 'research-lab-prune-confirm',
  researchLabCompose: 'research-lab-compose',
  researchLabComposeTopic: 'research-lab-compose-topic',
  researchLabComposeExample: 'research-lab-compose-example',
  researchLabComposeUseSources: 'research-lab-compose-use-sources',
  researchLabComposeAllowWeb: 'research-lab-compose-allow-web',
  researchLabComposeSourceList: 'research-lab-compose-source-list',
  researchLabComposeHint: 'research-lab-compose-hint',
  researchLabComposeSubmit: 'research-lab-compose-submit',
  researchLabComposeDepth: 'research-lab-compose-depth',
  researchLabComposeDepthShallow: 'research-lab-compose-depth-shallow',
  researchLabComposeDepthMedium: 'research-lab-compose-depth-medium',
  researchLabComposeDepthDeep: 'research-lab-compose-depth-deep',
  researchLabComposeModel: 'research-lab-compose-model',
  researchLabConfirmContinue: 'research-lab-confirm-continue',
  researchLabConfirmFinish: 'research-lab-confirm-finish',
  researchLabConfirmApprove: 'research-lab-confirm-approve',
  researchLabConfirmSkip: 'research-lab-confirm-skip',
  researchLabConvertNote: 'research-lab-convert-note',
  researchLabConvertSource: 'research-lab-convert-source',
  researchLabSynthesizeFailBanner: 'research-lab-synthesize-fail-banner',
  researchLabRetrySynthesize: 'research-lab-retry-synthesize',
  researchLabRetrySynthesizeModel: 'research-lab-retry-synthesize-model',
  researchTasksTrigger: 'research-tasks-trigger',
  researchTasksBadge: 'research-tasks-badge',
  researchTasksDrawer: 'research-tasks-drawer',
  researchTasksCreate: 'research-tasks-create',
  researchTasksEmpty: 'research-tasks-empty',
  researchTasksItem: 'research-tasks-item',

  // Search queue (existing)
  searchQueueList: 'search-queue-list',
  searchQueueItem: 'search-queue-item',
  searchQueueToggle: 'search-queue-toggle',

  // Citations (existing)
  citationPopover: 'citation-popover',
} as const;

export type TestId = (typeof TestIds)[keyof typeof TestIds];

/** Spread onto JSX: <button {...tid(TestIds.chatSend)} /> */
export function tid(id: string): { 'data-testid': string } {
  return { 'data-testid': id };
}
