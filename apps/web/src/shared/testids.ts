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
  sourcesModeToggle: 'sources-mode-toggle',
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

  // Research
  researchDetailDialog: 'research-detail-dialog',
  researchHistoryDialog: 'research-history-dialog',
  researchResultsDialog: 'research-results-dialog',
  researchExportDialog: 'research-export-dialog',
  researchApprovePlan: 'research-approve-plan',
  researchQueryCheckbox: 'research-query-checkbox',

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
