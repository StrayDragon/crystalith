import useSWR from 'swr';

export type OptionalServiceStatus = 'unknown' | 'disabled' | 'healthy' | 'degraded';

export type OptionalServiceKey = 'cacheRedis' | 'searchSearxng';

export interface DependencyServiceStatus {
  service: string;
  enabled: boolean;
  endpoint?: string | null;
  status: OptionalServiceStatus;
  healthy: boolean | null;
  error?: string | null;
  errorCode?: string | null;
  recoveryHint?: string | null;
  lastProbe?: string | null;
  degradePolicy?: string | null;
  hosts?: Record<
    string,
    {
      healthy: boolean;
      error?: string | null;
      modelCount?: number | null;
    }
  >;
}

export interface DependencyHealthResponse {
  status: string;
  generatedAt: string;
  lastProbe: string | null;
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

const OPTIONAL_SERVICE_LABELS = {
  cacheRedis: 'Redis (Cache)',
  searchSearxng: 'SearXNG (Search)',
} as const satisfies Record<OptionalServiceKey, string>;

export function toOptionalServiceDiagnostics(
  optional: DependencyHealthResponse['optional'] | null | undefined,
): DependencyDiagnosticItem[] {
  if (!optional) return [];
  const keys: OptionalServiceKey[] = ['cacheRedis', 'searchSearxng'];
  return keys.map((key) => {
    const entry = optional[key];
    return {
      key,
      label: OPTIONAL_SERVICE_LABELS[key],
      status: entry.status,
      enabled: entry.enabled,
      endpoint: entry.endpoint ?? null,
      errorCode: entry.errorCode ?? null,
      error: entry.error ?? null,
      recoveryHint: entry.recoveryHint ?? null,
      lastProbe: entry.lastProbe ?? null,
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
  const raw: unknown = await res.json();
  if (!isDependencyHealthResponse(raw)) {
    throw new Error('诊断响应格式无效');
  }
  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDependencyHealthResponse(value: unknown): value is DependencyHealthResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.status === 'string' &&
    typeof value.generatedAt === 'string' &&
    isRecord(value.core) &&
    isRecord(value.optional)
  );
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
