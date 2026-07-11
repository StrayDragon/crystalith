// Built-in filesystem source connector descriptors — mirrors v1 official plugins.
import type { SourceConnectorDescriptor } from './types.ts';

export const OBSIDIAN_EXTENSIONS = ['.md', '.markdown'] as const;

export const LOCAL_DIRECTORY_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.html',
  '.htm',
  '.pdf',
] as const;

export const BUILTIN_CONNECTORS: SourceConnectorDescriptor[] = [
  {
    connector_id: 'obsidian',
    display_name: 'Obsidian Vault',
    description: '从本地 Obsidian vault 枚举 Markdown 笔记并导入。',
    connection_config_schema: {
      type: 'object',
      properties: {
        vault_path: {
          type: 'string',
          title: 'Vault 路径',
          description: 'Obsidian vault 的本地目录路径（后端可读）。',
          minLength: 1,
        },
      },
      required: ['vault_path'],
      additionalProperties: false,
    },
    diagnostics: null,
    capabilities: {
      supports_snapshot: true,
      supports_sync_check: true,
    },
  },
  {
    connector_id: 'local-directory',
    display_name: 'Local Directory',
    description: '从本地目录枚举文件并导入。',
    connection_config_schema: {
      type: 'object',
      properties: {
        directory_path: {
          type: 'string',
          title: '目录路径',
          description: '要导入的本地目录路径（后端可读）。',
          minLength: 1,
        },
      },
      required: ['directory_path'],
      additionalProperties: false,
    },
    diagnostics: null,
    capabilities: {
      supports_snapshot: true,
      supports_sync_check: true,
    },
  },
];

export function getBuiltinConnector(connectorId: string): SourceConnectorDescriptor | undefined {
  return BUILTIN_CONNECTORS.find((c) => c.connector_id === connectorId);
}

export function rootPathKeyForConnector(connectorId: string): string {
  if (connectorId === 'obsidian') return 'vault_path';
  if (connectorId === 'local-directory') return 'directory_path';
  return 'directory_path';
}

export function extensionsForConnector(connectorId: string): readonly string[] {
  if (connectorId === 'obsidian') return OBSIDIAN_EXTENSIONS;
  if (connectorId === 'local-directory') return LOCAL_DIRECTORY_EXTENSIONS;
  return [];
}
