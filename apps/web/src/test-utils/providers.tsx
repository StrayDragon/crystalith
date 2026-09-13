import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { LayerProvider } from '../shared/layer';
import { TooltipProvider } from '../shared/ui';

/** Match production: LayerProvider + TooltipProvider for UI tests. */
export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <LayerProvider>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </LayerProvider>
  );
}

/** Theme + Layer + isolated SWR cache (hook / panel tests). */
export function TestProvidersWithSWR({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}
      >
        {children}
      </SWRConfig>
    </TestProviders>
  );
}
