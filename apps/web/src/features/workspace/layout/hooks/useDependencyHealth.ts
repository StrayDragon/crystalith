import useSWR from 'swr';

export type OptionalServiceStatus = 'unknown' | 'disabled' | 'healthy' | 'degraded';

export type OptionalServiceKey = 'storage_chroma' | 'cache_redis' | 'search_searxng';

export interface DependencyServiceStatus {
  service: string;
  enabled: boolean;
  endpoint?: string | null;
  status: OptionalServiceStatus;
  healthy: boolean | null;
  error?: string | null;
  error_code?: string | null;
  recovery_hint?: string | null;
  last_probe?: string | null;
  degrade_policy?: string | null;
  hosts?: Record<
    string,
    {
      healthy: boolean;
      error?: string | null;
      model_count?: number | null;
    }
  >;
}

export interface DependencyHealthResponse {
  status: string;
  generated_at: string;
  last_probe: string | null;
  core: Record<
    string,
    {
      service: string;
      healthy: boolean | null;
      note?: string | null;
    }
  >;
  optional: Record<OptionalServiceKey, DependencyServiceStatus>;
}

export interface DependencyDiagnosticItem {
  key: OptionalServiceKey;
  label: string;
  status: OptionalServiceStatus;
  enabled: boolean;
  endpoint: string | null;
  errorCode: string | null;
  error: string | null;
  recoveryHint: string | null;
  lastProbe: string | null;
}

const OPTIONAL_SERVICE_LABELS: Record<OptionalServiceKey, string> = {
  storage_chroma: 'Chroma (Vector Store)',
  cache_redis: 'Redis (Cache)',
  search_searxng: 'SearXNG (Search)',
};

export function toOptionalServiceDiagnostics(
  optional: DependencyHealthResponse['optional'] | null | undefined,
): DependencyDiagnosticItem[] {
  if (!optional) return [];
  const keys: OptionalServiceKey[] = ['storage_chroma', 'cache_redis', 'search_searxng'];
  return keys.map((key) => {
    const entry = optional[key];
    return {
      key,
      label: OPTIONAL_SERVICE_LABELS[key],
      status: entry.status,
      enabled: entry.enabled,
      endpoint: entry.endpoint ?? null,
      errorCode: entry.error_code ?? null,
      error: entry.error ?? null,
      recoveryHint: entry.recovery_hint ?? null,
      lastProbe: entry.last_probe ?? null,
    };
  });
}

async function fetchDependencyHealth(force = false): Promise<DependencyHealthResponse> {
  const query = force ? `?force=1&_ts=${Date.now()}` : '';
  const res = await fetch(`/health/dependencies${query}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: force ? 'no-store' : 'default',
  });
  if (!res.ok) {
    throw new Error(`诊断请求失败（HTTP ${res.status}）`);
  }
  return res.json() as Promise<DependencyHealthResponse>;
}

export function useDependencyHealth(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const swr = useSWR<DependencyHealthResponse>(
    enabled ? 'workspace/health/dependencies' : null,
    () => fetchDependencyHealth(false),
    { revalidateOnFocus: false },
  );

  return {
    data: swr.data ?? null,
    error: swr.error instanceof Error ? swr.error.message : swr.error ? String(swr.error) : '',
    isLoading: swr.isLoading,
    refresh: async () => {
      const next = await fetchDependencyHealth(true);
      await swr.mutate(next, { revalidate: false, populateCache: true });
      return next;
    },
  };
}
