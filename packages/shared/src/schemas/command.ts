// Command palette schemas — GET /v2/commands.
import './zod-extend.js';
import { z } from 'zod';

export const CommandSourceSchema = z.enum(['builtin', 'custom']);
export type CommandSource = z.infer<typeof CommandSourceSchema>;

export const CommandSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('prompt_preset'),
    trigger: z.string().min(1),
    description: z.string(),
    enabled: z.boolean(),
    source: CommandSourceSchema,
  })
  .openapi({
    description: '命令面板条目（prompt preset）',
  });
export type Command = z.infer<typeof CommandSchema>;

export const CommandListSchema = z.array(CommandSchema);
export type CommandList = z.infer<typeof CommandListSchema>;
