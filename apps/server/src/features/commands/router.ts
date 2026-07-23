// Commands router — GET /v2/commands (command palette API)
//
// Lists prompt presets + deep-research nav slash commands (c99).
import { CommandListSchema } from '@crystalith/shared';
import { Elysia } from 'elysia';

import { db } from '../../db/index.ts';
import { promptPresets } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { listPresets } from '../qa/presets.ts';

type CommandRow = {
  id: string;
  kind: 'prompt_preset' | 'nav';
  trigger: string;
  description: string;
  enabled: boolean;
  source: 'builtin' | 'custom';
};

const RESEARCH_NAV_COMMANDS: CommandRow[] = [
  {
    id: 'nav.research',
    kind: 'nav',
    trigger: '/research',
    description: '打开深研 Lab Compose（可选：/research <主题> 预填）',
    enabled: true,
    source: 'builtin',
  },
  {
    id: 'nav.research.zh',
    kind: 'nav',
    trigger: '/深研',
    description: '打开深研 Lab Compose（可选：/深研 <主题> 预填）',
    enabled: true,
    source: 'builtin',
  },
  {
    id: 'nav.research-open',
    kind: 'nav',
    trigger: '/research-open',
    description: '深链已有 Run：/research-open <rid>',
    enabled: true,
    source: 'builtin',
  },
];

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/commands',
    method: 'get',
    summary: '列出命令面板可用命令（提示词预设与深研导航）',
    tags: ['commands'],
    responses: { 200: { description: '命令列表', body: CommandListSchema } },
  },
];

registerApiDoc(apiDocs);

export const commandsRouter = new Elysia({ prefix: '/v2' }).get(
  '/commands',
  () => {
    const commands: CommandRow[] = [...RESEARCH_NAV_COMMANDS];

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
