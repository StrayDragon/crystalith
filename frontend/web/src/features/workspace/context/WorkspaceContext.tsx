import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';

import {
  initialWorkspaceState,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState,
} from './workspaceReducer';

const WorkspaceStateContext = createContext<WorkspaceState | undefined>(undefined);
const WorkspaceDispatchContext = createContext<Dispatch<WorkspaceAction> | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const memoizedState = useMemo(() => state, [state]);

  return (
    <WorkspaceStateContext.Provider value={memoizedState}>
      <WorkspaceDispatchContext.Provider value={dispatch}>
        {children}
      </WorkspaceDispatchContext.Provider>
    </WorkspaceStateContext.Provider>
  );
}

export function useWorkspaceState(): WorkspaceState {
  const context = useContext(WorkspaceStateContext);
  if (!context) {
    throw new Error('useWorkspaceState must be used within WorkspaceProvider');
  }
  return context;
}

export function useWorkspaceDispatch(): Dispatch<WorkspaceAction> {
  const context = useContext(WorkspaceDispatchContext);
  if (!context) {
    throw new Error('useWorkspaceDispatch must be used within WorkspaceProvider');
  }
  return context;
}
