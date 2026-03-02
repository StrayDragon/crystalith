import { useMemo } from 'react';
import useSWR from 'swr';

import {
  listCommandsV1CommandsGet as listCommands,
  type CommandRead,
} from '../../../../api/generated';
import { unwrapData } from '../../../../api/unwrap';

export const COMMANDS_CACHE_KEY = 'workspace/commands';

function normalizeCommand(command: CommandRead): Required<Pick<CommandRead, 'description' | 'enabled'>> & CommandRead {
  return {
    ...command,
    description: command.description ?? '',
    enabled: command.enabled ?? true,
  };
}

export function useCommands(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(enabled ? COMMANDS_CACHE_KEY : null, () => unwrapData(listCommands<true>()), {
    revalidateOnFocus: false,
  });

  const commands = useMemo(() => (data ? data.map(normalizeCommand) : []), [data]);

  return {
    commands,
    isLoading,
    error: error ? String(error) : '',
    refresh: mutate,
  };
}
