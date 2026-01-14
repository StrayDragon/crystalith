import type { AsyncStatus } from '../../../shared/types';
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
  RefineJob,
  RefineMode,
  RefineSettings,
  SessionSummary,
  SourceItem,
  SuggestionItem,
} from '../types';

export interface WorkspaceState {
  notebooks: Notebook[];
  sources: SourceItem[];
  sessions: SessionSummary[];
  messages: ChatMessage[];
  suggestions: SuggestionItem[];
  outputs: OutputItem[];
  activeNotebookId: number | null;
  activeSessionId: number | null;
  activePanel: PanelId;
  draft: string;
  citations: Citation[];
  selectedCitationIds: Record<string, boolean>;
  autoSelectCitations: boolean;
  hoveredCitationChunkId: number | null;
  hoveredMessageChunkIds: number[];
  jumpToCitationChunkId: number | null;
  refineMode: RefineMode;
  refinePrompt: string;
  refineJobs: RefineJob[];
  refineSettings: RefineSettings;
  hasNewOutput: boolean;
  recentCompletedJobId: string | null;
  createState: AsyncStatus;
  createName: string;
  connectionState: ConnectionState;
  uploadState: AsyncStatus;
  loading: LoadingState;
  errors: ErrorsState;
  outputType: OutputTypeId;
}

export type WorkspaceAction =
  | { type: 'SET_NOTEBOOKS'; payload: Notebook[] }
  | { type: 'SET_SOURCES'; payload: SourceItem[] }
  | { type: 'SET_SESSIONS'; payload: SessionSummary[] }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_SUGGESTIONS'; payload: SuggestionItem[] }
  | { type: 'SET_OUTPUTS'; payload: OutputItem[] }
  | { type: 'SET_ACTIVE_NOTEBOOK'; payload: number | null }
  | { type: 'SET_ACTIVE_SESSION'; payload: number | null }
  | { type: 'SET_ACTIVE_PANEL'; payload: PanelId }
  | { type: 'SET_DRAFT'; payload: string }
  | { type: 'SET_CITATIONS'; payload: Citation[] }
  | { type: 'SET_SELECTED_CITATIONS'; payload: Record<string, boolean> }
  | { type: 'SET_AUTO_SELECT_CITATIONS'; payload: boolean }
  | { type: 'SET_HOVERED_CITATION'; payload: number | null }
  | { type: 'SET_HOVERED_MESSAGE_CHUNKS'; payload: number[] }
  | { type: 'SET_JUMP_TO_CITATION'; payload: number | null }
  | { type: 'SET_REFINE_MODE'; payload: RefineMode }
  | { type: 'SET_REFINE_PROMPT'; payload: string }
  | { type: 'SET_REFINE_JOBS'; payload: RefineJob[] }
  | { type: 'SET_REFINE_SETTINGS'; payload: RefineSettings }
  | { type: 'SET_HAS_NEW_OUTPUT'; payload: boolean }
  | { type: 'SET_RECENT_COMPLETED_JOB'; payload: string | null }
  | { type: 'SET_CREATE_STATE'; payload: AsyncStatus }
  | { type: 'SET_CREATE_NAME'; payload: string }
  | { type: 'SET_CONNECTION_STATE'; payload: ConnectionState }
  | { type: 'SET_UPLOAD_STATE'; payload: AsyncStatus }
  | { type: 'SET_LOADING'; payload: { key: keyof LoadingState; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof ErrorsState; value: string } }
  | { type: 'SET_OUTPUT_TYPE'; payload: OutputTypeId };

export const initialWorkspaceState: WorkspaceState = {
  notebooks: [],
  sources: [],
  sessions: [],
  messages: [],
  suggestions: [],
  outputs: [],
  activeNotebookId: null,
  activeSessionId: null,
  activePanel: 'chat',
  draft: '',
  citations: [],
  selectedCitationIds: {},
  autoSelectCitations: false,
  hoveredCitationChunkId: null,
  hoveredMessageChunkIds: [],
  jumpToCitationChunkId: null,
  refineMode: 'paragraph',
  refinePrompt: '',
  refineJobs: [],
  refineSettings: {
    autoTrigger: false,
    asyncQueue: true,
  },
  hasNewOutput: false,
  recentCompletedJobId: null,
  createState: 'idle',
  createName: '',
  connectionState: 'connecting',
  uploadState: 'idle',
  loading: {
    notebooks: false,
    sources: false,
    sessions: false,
    messages: false,
    suggestions: false,
    outputs: false,
    send: false,
  },
  errors: {
    notebooks: '',
    sources: '',
    sessions: '',
    messages: '',
    suggestions: '',
    outputs: '',
    send: '',
    create: '',
  },
  outputType: 'FAQ',
};

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'SET_NOTEBOOKS':
      return { ...state, notebooks: action.payload };
    case 'SET_SOURCES':
      return { ...state, sources: action.payload };
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload };
    case 'SET_OUTPUTS':
      return { ...state, outputs: action.payload };
    case 'SET_ACTIVE_NOTEBOOK':
      return {
        ...state,
        activeNotebookId: action.payload,
        activeSessionId: null,
        sources: [],
        sessions: [],
        messages: [],
        suggestions: [],
        outputs: [],
        citations: [],
        selectedCitationIds: {},
        autoSelectCitations: false,
        hoveredCitationChunkId: null,
        hoveredMessageChunkIds: [],
        jumpToCitationChunkId: null,
        refineJobs: [],
        hasNewOutput: false,
        recentCompletedJobId: null,
        errors: {
          ...state.errors,
          sources: '',
          sessions: '',
          messages: '',
          suggestions: '',
          outputs: '',
          send: '',
        },
      };
    case 'SET_ACTIVE_SESSION':
      return {
        ...state,
        activeSessionId: action.payload,
        messages: [],
        suggestions: [],
        citations: [],
        selectedCitationIds: {},
        autoSelectCitations: false,
        hoveredCitationChunkId: null,
        hoveredMessageChunkIds: [],
        jumpToCitationChunkId: null,
        errors: {
          ...state.errors,
          messages: '',
          suggestions: '',
          send: '',
        },
      };
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.payload };
    case 'SET_DRAFT':
      return { ...state, draft: action.payload };
    case 'SET_CITATIONS':
      return { ...state, citations: action.payload };
    case 'SET_SELECTED_CITATIONS':
      return { ...state, selectedCitationIds: action.payload };
    case 'SET_AUTO_SELECT_CITATIONS':
      return { ...state, autoSelectCitations: action.payload };
    case 'SET_HOVERED_CITATION':
      return { ...state, hoveredCitationChunkId: action.payload };
    case 'SET_HOVERED_MESSAGE_CHUNKS':
      return { ...state, hoveredMessageChunkIds: action.payload };
    case 'SET_JUMP_TO_CITATION':
      return { ...state, jumpToCitationChunkId: action.payload };
    case 'SET_REFINE_MODE':
      return { ...state, refineMode: action.payload };
    case 'SET_REFINE_PROMPT':
      return { ...state, refinePrompt: action.payload };
    case 'SET_REFINE_JOBS':
      return { ...state, refineJobs: action.payload };
    case 'SET_REFINE_SETTINGS':
      return { ...state, refineSettings: action.payload };
    case 'SET_HAS_NEW_OUTPUT':
      return { ...state, hasNewOutput: action.payload };
    case 'SET_RECENT_COMPLETED_JOB':
      return { ...state, recentCompletedJobId: action.payload };
    case 'SET_CREATE_STATE':
      return { ...state, createState: action.payload };
    case 'SET_CREATE_NAME':
      return { ...state, createName: action.payload };
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.payload };
    case 'SET_UPLOAD_STATE':
      return { ...state, uploadState: action.payload };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.key]: action.payload.value },
      };
    case 'SET_OUTPUT_TYPE':
      return { ...state, outputType: action.payload };
    default:
      return state;
  }
}
