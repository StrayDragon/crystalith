// Commands router — GET /v2/commands (command palette API)
//
// Lists all available commands (prompt presets, built-in presets) for the
// frontend command palette / slash-command interface.
// Mirrors v1 `features/commands/api.py`.
import { CommandListSchema } from '@crystalith/shared';
import { Elysia } from 'elysia';

import { db } from '../../db/index.ts';
import { promptPresets } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { listPresets } from '../qa/presets.ts';

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/commands',
    method: 'get',
    summary: 'List all available commands (prompt presets)',
    tags: ['commands'],
    responses: { 200: { description: 'Command list', body: CommandListSchema } },
  },
];

registerApiDoc(apiDocs);

export const commandsRouter = new Elysia({ prefix: '/v2' }).get(
  '/commands',
  () => {
    const commands: Array<{
      id: string;
      kind: 'prompt_preset';
      trigger: string;
      description: string;
      enabled: boolean;
      source: 'builtin' | 'custom';
    }> = [];

    // Built-in QA presets
    for (const { name, label } of listPresets()) {
      commands.push({
        id: name,
        kind: 'prompt_preset',
        trigger: `/prompt:${name}`,
        description: label,
        enabled: true,
        source: 'builtin',
      });
    }

    // Custom prompt presets from DB
    const custom = db().select().from(promptPresets).all();
    for (const preset of custom) {
      commands.push({
        id: preset.trigger,
        kind: 'prompt_preset',
        trigger: `/prompt:${preset.trigger}`,
        description: preset.description ?? '',
        enabled: preset.enabled,
        source: 'custom',
      });
    }

    commands.sort((a, b) => a.trigger.localeCompare(b.trigger));
    return commands;
  },
  { response: CommandListSchema },
);
