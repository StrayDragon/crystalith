// @crystalith-plugin/parser-docx — official exemplar parser plugin.
//
// Word .docx → markdown via mammoth (pure JS, no native addon).
// Non-docx inputs are not this plugin's job: the host selects by MIME/extension.
//
// This package MUST NOT import apps/server (keeps the workspace acyclic so the
// server can statically import the plugin into the compiled binary). Types
// come from @crystalith/shared.
import { Buffer } from 'node:buffer';

import type { CrystalithPlugin } from '@crystalith/shared';
import mammoth from 'mammoth';
import { z } from 'zod';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** mammoth's published types omit convertToMarkdown; the runtime export exists. */
function convertToMarkdown(buffer: Buffer): Promise<{ value: string }> {
  return (
    mammoth as unknown as {
      convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    }
  ).convertToMarkdown({ buffer });
}

async function parseDocx(buf: Uint8Array, filename?: string): Promise<{ text: string }> {
  try {
    const result = await convertToMarkdown(Buffer.from(buf));
    return { text: result.value };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`docx parse failed${filename ? ` (${filename})` : ''}: ${message}`);
    (wrapped as Error & { errorCode: string }).errorCode = 'PARSE_ERROR';
    throw wrapped;
  }
}

export const parserDocx = {
  id: 'parser-docx',
  kind: 'parser' as const,
  displayName: 'Word (docx)',
  description: 'mammoth 将 .docx 转为可检索 markdown 正文，纯 JS、无需外部服务',
  recoveryHint:
    '安装 @crystalith-plugin/parser-docx 后重启 server；从 plugins.disabled 移除 parser-docx',
  configSchema: z.object({}) as z.ZodObject,
  capabilities: [] as const,
  factory: async () => ({
    id: 'docx',
    name: 'Word (docx)',
    mimeTypes: [DOCX_MIME],
    extensions: ['.docx'],
    parse: parseDocx,
  }),
} satisfies CrystalithPlugin;

export default parserDocx;
