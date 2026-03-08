import { createKernel, type RivuKernel } from "rivu-kernel";
import {
  createHost,
  createRegistry,
  type RivuComponentRegistry,
  type RivuHost,
} from "rivu-react/registry";
import { viewerRegistryV1 } from "rivu-react/ui-kit/viewer";
import { workflowRegistryV1 } from "rivu-react/ui-kit/workflow";
import type { UiV1CustomEvent } from "rivu-ui-spec";

interface CreateRivuSessionRuntimeOptions {
  notebookId: number;
  sessionId: number;
}

export interface SessionUiStatePayload {
  session_id: number;
  shared_state: Record<string, unknown>;
  shared_state_revision: number;
}

export interface SessionUiEventResponse {
  delta: Array<Record<string, unknown>>;
  shared_state_revision: number;
}

export interface RivuSessionRuntime {
  kernel: RivuKernel;
  registry: RivuComponentRegistry;
  host: RivuHost;
  dispatchSnapshot: (snapshot: Record<string, unknown>) => void;
  dispatchDelta: (delta: Array<Record<string, unknown>>) => void;
}

const registry = createRegistry({
  ...viewerRegistryV1,
  ...workflowRegistryV1,
});

const host = createHost({
  registry,
});

function getErrorMessage(detail: unknown, fallback: string) {
  if (typeof detail === "string" && detail) {
    return detail;
  }
  if (
    detail &&
    typeof detail === "object" &&
    "detail" in detail &&
    typeof (detail as { detail?: unknown }).detail === "string"
  ) {
    return (detail as { detail: string }).detail;
  }
  return fallback;
}

export function createRivuSessionRuntime(
  options: CreateRivuSessionRuntimeOptions,
): RivuSessionRuntime {
  let transportSeq = 0;

  const dispatchEnvelope = (event: Record<string, unknown>) => {
    transportSeq += 1;
    kernel.dispatch({ seq: transportSeq, event });
  };

  const kernel = createKernel({
    actionTransport: async (action) => {
      const response = await fetch(
        `/v1/notebooks/${options.notebookId}/sessions/${options.sessionId}/ui/event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(action satisfies UiV1CustomEvent),
        },
      );

      if (!response.ok) {
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        throw new Error(getErrorMessage(payload, `UI event failed: HTTP ${response.status}`));
      }

      const payload = (await response.json()) as SessionUiEventResponse;
      dispatchEnvelope({
        type: "STATE_DELTA",
        delta: Array.isArray(payload.delta) ? payload.delta : [],
      });
    },
  });

  return {
    kernel,
    registry,
    host,
    dispatchSnapshot: (snapshot) => {
      dispatchEnvelope({
        type: "STATE_SNAPSHOT",
        snapshot,
      });
    },
    dispatchDelta: (delta) => {
      dispatchEnvelope({
        type: "STATE_DELTA",
        delta,
      });
    },
  };
}
