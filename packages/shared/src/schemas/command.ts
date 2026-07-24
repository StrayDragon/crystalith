// Command palette schemas — GET /v2/commands.
import './zod-extend.js';
import { z } from 'zod';

import { desc } from './i18n.js';

export const CommandSourceSchema = z.enum(['builtin', 'custom']);
export type CommandSource = z.infer<typeof CommandSourceSchema>;

export const CommandKindSchema = z.enum(['prompt_preset', 'nav']);
export type CommandKind = z.infer<typeof CommandKindSchema>;

export const CommandSchema = z
  .object({
    id: z.string().min(1),
    kind: CommandKindSchema,
    trigger: z.string().min(1),
    description: z.string(),
    enabled: z.boolean(),
    source: CommandSourceSchema,
  })
  .openapi({
    description: desc('command.palette_item', '命令面板条目（prompt 预设或深研导航）'),
  });
export type Command = z.infer<typeof CommandSchema>;

export const CommandListSchema = z.array(CommandSchema);
export type CommandList = z.infer<typeof CommandListSchema>;
