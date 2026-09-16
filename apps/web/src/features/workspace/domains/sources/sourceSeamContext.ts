import type { Source } from '@crystalith/shared';

/** Shared context every source seam hook needs (W6 five-seam split). */
export interface SourceSeamContext {
  activeNotebookId: number | null;
  isConnected: boolean;
  /** Revalidate the sources list SWR. */
  mutate: () => Promise<Source[] | undefined>;
}
