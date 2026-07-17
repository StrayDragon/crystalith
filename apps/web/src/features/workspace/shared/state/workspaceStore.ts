import { create } from 'zustand';

import type { AsyncStatus } from '../../../../shared/types';
import type {
  ChatMessage,
  Citation,
  ConnectionState,
  ErrorsState,
  LoadingState,
  Notebook,
  OutputItem,
  OutputTypeId,
  PanelId,
  FrontendBundleDescriptor,
  RenderDescriptor,
  RefineJob,
  RefineMode,
  RefineSettings,
  SessionSummary,
  SourceItem,
} from '../types';

// ---------------------------------------------------------------------------
// State shape — identical to the former WorkspaceState
// ---------------------------------------------------------------------------
export interface WorkspaceStoreState {
  // --- Notebooks ---
  notebooks: Notebook[];
  activeNotebookId: number | null;
  autoCreatedNotebookId: number | null;

  // --- Sessions ---
  sessions: SessionSummary[];
  activeSessionId: number | null;

  // --- Sources ---
  sources: SourceItem[];
  selectedSourceIds: Record<number, boolean>;

  // --- Messages / Chat ---
  messages: ChatMessage[];
  draft: string;
  citations: Citation[];
  hoveredCitationChunkId: number | null;
  hoveredMessageChunkIds: number[];
  jumpToCitationChunkId: number | null;
  /** Locate a source row in the sources list (token bumps to re-fire). */
  jumpToSourceTarget: { id: number; token: number } | null;

  // --- Outputs ---
  outputs: OutputItem[];
  outputType: OutputTypeId;
  outputTypeRenderDescriptors: Partial<Record<OutputTypeId, RenderDescriptor>>;
  outputTypeFrontendBundles: Partial<Record<OutputTypeId, FrontendBundleDescriptor>>;

  // --- Refine ---
  refineMode: RefineMode;
  refinePrompt: string;
  refineJobs: RefineJob[];
  refineSettings: RefineSettings;
  hasNewOutput: boolean;
  recentCompletedJobId: string | null;

  // --- UI / Connection ---
  activePanel: PanelId;
  createState: AsyncStatus;
  createName: string;
  connectionState: ConnectionState;
  uploadState: AsyncStatus;
  loading: LoadingState;
  errors: ErrorsState;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export interface WorkspaceStoreActions {
  // --- Notebooks ---
  setNotebooks: (notebooks: Notebook[]) => void;
  setActiveNotebook: (id: number | null) => void;
  setAutoCreatedNotebookId: (id: number | null) => void;

  // --- Sessions ---
  setSessions: (sessions: SessionSummary[]) => void;
  setActiveSession: (id: number | null) => void;

  // --- Sources ---
  setSources: (sources: SourceItem[]) => void;
  setSelectedSources: (selected: Record<number, boolean>) => void;

  // --- Messages / Chat ---
  setMessages: (messages: ChatMessage[]) => void;
  appendMessageContent: (messageId: string, text: string) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  addStreamingMessage: (message: ChatMessage) => void;
  setDraft: (draft: string) => void;
  setCitations: (citations: Citation[]) => void;
  setHoveredCitation: (chunkId: number | null) => void;
  setHoveredMessageChunks: (chunkIds: number[]) => void;
  setJumpToCitation: (chunkId: number | null) => void;
  locateSourceInList: (sourceId: number) => void;

  // --- Outputs ---
  setOutputs: (outputs: OutputItem[]) => void;
  setOutputType: (type: OutputTypeId) => void;
  setOutputTypeRenderDescriptors: (
    descriptors: Partial<Record<OutputTypeId, RenderDescriptor>>,
  ) => void;
  setOutputTypeFrontendBundles: (
    bundles: Partial<Record<OutputTypeId, FrontendBundleDescriptor>>,
  ) => void;

  // --- Refine ---
  setRefineMode: (mode: RefineMode) => void;
  setRefinePrompt: (prompt: string) => void;
  setRefineJobs: (jobs: RefineJob[]) => void;
  setRefineSettings: (settings: RefineSettings) => void;
  setHasNewOutput: (value: boolean) => void;
  setRecentCompletedJob: (id: string | null) => void;

  // --- UI / Connection ---
  setActivePanel: (panel: PanelId) => void;
  setCreateState: (status: AsyncStatus) => void;
  setCreateName: (name: string) => void;
  setConnectionState: (state: ConnectionState) => void;
  setUploadState: (status: AsyncStatus) => void;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
  setError: (key: keyof ErrorsState, value: string) => void;
}

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const initialState: WorkspaceStoreState = {
  notebooks: [],
  activeNotebookId: null,
  autoCreatedNotebookId: null,
  sessions: [],
  activeSessionId: null,
  sources: [],
  selectedSourceIds: {},
  messages: [],
  draft: '',
  citations: [],
  hoveredCitationChunkId: null,
  hoveredMessageChunkIds: [],
  jumpToCitationChunkId: null,
  jumpToSourceTarget: null,
  outputs: [],
  outputType: 'FAQ',
  outputTypeRenderDescriptors: {},
  outputTypeFrontendBundles: {},
  refineMode: 'paragraph',
  refinePrompt: '',
  refineJobs: [],
  refineSettings: {
    autoTrigger: false,
    asyncQueue: true,
  },
  hasNewOutput: false,
  recentCompletedJobId: null,
  activePanel: 'chat',
  createState: 'idle',
  createName: '',
  connectionState: 'connecting',
  uploadState: 'idle',
  loading: {
    notebooks: false,
    sources: false,
    sessions: false,
    messages: false,
    outputs: false,
    send: false,
  },
  errors: {
    notebooks: '',
    sources: '',
    sessions: '',
    messages: '',
    outputs: '',
    send: '',
    create: '',
  },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  ...initialState,

  // --- Notebooks ---
  setNotebooks: (notebooks) => set({ notebooks }),
  setActiveNotebook: (id) =>
    set((state) => ({
      activeNotebookId: id,
      // Reset dependent state when switching notebooks (mirrors old reducer)
      activeSessionId: null,
      sources: [],
      sessions: [],
      messages: [],
      outputs: [],
      citations: [],
      selectedSourceIds: {},
      hoveredCitationChunkId: null,
      hoveredMessageChunkIds: [],
      jumpToCitationChunkId: null,
      jumpToSourceTarget: null,
      refineJobs: [],
      hasNewOutput: false,
      recentCompletedJobId: null,
      errors: {
        ...state.errors,
        sources: '',
        sessions: '',
        messages: '',
        outputs: '',
        send: '',
      },
    })),
  setAutoCreatedNotebookId: (autoCreatedNotebookId) => set({ autoCreatedNotebookId }),

  // --- Sessions ---
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) =>
    set((state) => ({
      activeSessionId: id,
      // Reset messages & citations when switching sessions (mirrors old reducer)
      messages: [],
      citations: [],
      hoveredCitationChunkId: null,
      hoveredMessageChunkIds: [],
      jumpToCitationChunkId: null,
      jumpToSourceTarget: null,
      errors: {
        ...state.errors,
        messages: '',
        send: '',
      },
    })),

  // --- Sources ---
  setSources: (sources) => set({ sources }),
  setSelectedSources: (selected) => set({ selectedSourceIds: selected }),

  // --- Messages / Chat ---
  setMessages: (messages) => set({ messages }),
  appendMessageContent: (messageId, text) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: msg.content + text } : msg,
      ),
    })),
  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg)),
    })),
  addStreamingMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setDraft: (draft) => set({ draft }),
  setCitations: (citations) => set({ citations }),
  setHoveredCitation: (chunkId) => set({ hoveredCitationChunkId: chunkId }),
  setHoveredMessageChunks: (chunkIds) =>
    set((state) => {
      if (
        state.hoveredMessageChunkIds.length === chunkIds.length &&
        state.hoveredMessageChunkIds.every((id, index) => id === chunkIds[index])
      ) {
        return state;
      }
      return { hoveredMessageChunkIds: chunkIds };
    }),
  setJumpToCitation: (chunkId) => set({ jumpToCitationChunkId: chunkId }),
  locateSourceInList: (sourceId) =>
    set((state) => ({
      jumpToSourceTarget: {
        id: sourceId,
        token: (state.jumpToSourceTarget?.token ?? 0) + 1,
      },
    })),

  // --- Outputs ---
  setOutputs: (outputs) => set({ outputs }),
  setOutputType: (type) => set({ outputType: type }),
  setOutputTypeRenderDescriptors: (descriptors) =>
    set({ outputTypeRenderDescriptors: descriptors }),
  setOutputTypeFrontendBundles: (bundles) => set({ outputTypeFrontendBundles: bundles }),

  // --- Refine ---
  setRefineMode: (mode) => set({ refineMode: mode }),
  setRefinePrompt: (prompt) => set({ refinePrompt: prompt }),
  setRefineJobs: (jobs) => set({ refineJobs: jobs }),
  setRefineSettings: (settings) => set({ refineSettings: settings }),
  setHasNewOutput: (value) => set({ hasNewOutput: value }),
  setRecentCompletedJob: (id) => set({ recentCompletedJobId: id }),

  // --- UI / Connection ---
  setActivePanel: (panel) => set({ activePanel: panel }),
  setCreateState: (status) => set({ createState: status }),
  setCreateName: (name) => set({ createName: name }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setUploadState: (status) => set({ uploadState: status }),
  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),
  setError: (key, value) =>
    set((state) => ({
      errors: { ...state.errors, [key]: value },
    })),
}));
