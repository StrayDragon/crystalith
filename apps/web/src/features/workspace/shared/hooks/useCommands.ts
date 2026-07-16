import { useMemo } from 'react';
import useSWR from 'swr';

import { api } from '../../../../api/eden';

export const COMMANDS_CACHE_KEY = 'workspace/commands';

interface CommandItem {
  id: string;
  trigger: string;
  description: string | null;
  system_prompt: string;
  enabled: boolean;
  kind?: string;
  source?: 'builtin' | 'custom';
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
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? COMMANDS_CACHE_KEY : null,
    async () => {
      const { data: result, error: fetchErr } = await api.v2.commands.get();
      if (fetchErr)
        throw new Error(
          typeof fetchErr === 'string' ? fetchErr : typeof fetchErr === 'string' ? fetchErr : '',
        );
      return (result ?? []) as CommandItem[];
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
