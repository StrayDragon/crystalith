import { useMemo } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';

export const COMMANDS_CACHE_KEY = 'workspace/commands';

interface CommandItem {
  id: string;
  trigger: string;
  description: string | null;
  enabled: boolean;
  kind?: 'prompt_preset' | 'nav' | string;
  source?: 'builtin' | 'custom';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCommandItem(value: unknown): CommandItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.trigger !== 'string') return null;
  if (typeof value.enabled !== 'boolean' && value.enabled !== undefined) return null;
  if (
    typeof value.description !== 'string' &&
    value.description !== null &&
    value.description !== undefined
  ) {
    return null;
  }
  return {
    id: value.id,
    trigger: value.trigger,
    description: typeof value.description === 'string' ? value.description : null,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    kind: typeof value.kind === 'string' ? value.kind : undefined,
    source: value.source === 'builtin' || value.source === 'custom' ? value.source : undefined,
  };
}

function normalizeCommand(
  command: CommandItem,
): CommandItem & { description: string; enabled: boolean } {
  return {
    ...command,
    description: command.description ?? '',
    enabled: command.enabled ?? true,
  };
}

export function useCommands(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { data, error, isLoading, mutate } = useSWR<CommandItem[], Error>(
    enabled ? COMMANDS_CACHE_KEY : null,
    async (): Promise<CommandItem[]> => {
      const { data: result, error: fetchErr } = await api.v2.commands.get();
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      if (!Array.isArray(result)) return [];
      return result.flatMap((item) => {
        const command = toCommandItem(item);
        return command ? [command] : [];
      });
    },
    {
      revalidateOnFocus: false,
    },
  );

  const commands = useMemo(() => (data ? data.map(normalizeCommand) : []), [data]);

  return {
    commands,
    isLoading,
    error: error ? String(error) : '',
    refresh: mutate,
  };
}
