import { ThemeProvider } from '@material-tailwind/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { LayerProvider } from '../shared/layer';

/** Match production `main.tsx`: MT ThemeProvider + LayerProvider for UI tests. */
export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LayerProvider>{children}</LayerProvider>
    </ThemeProvider>
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
