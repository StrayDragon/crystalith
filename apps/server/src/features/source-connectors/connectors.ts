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
    connectorId: 'obsidian',
    displayName: 'Obsidian Vault',
    description: '从本地 Obsidian vault 枚举 Markdown 笔记并导入。',
    connectionConfigSchema: {
      type: 'object',
      properties: {
        vaultPath: {
          type: 'string',
          title: 'Vault 路径',
          description: 'Obsidian vault 的本地目录路径（后端可读）。',
          minLength: 1,
        },
      },
      required: ['vaultPath'],
      additionalProperties: false,
    },
    diagnostics: null,
    capabilities: {
      supportsSnapshot: true,
      supportsSyncCheck: true,
    },
  },
  {
    connectorId: 'local-directory',
    displayName: 'Local Directory',
    description: '从本地目录枚举文件并导入。',
    connectionConfigSchema: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          title: '目录路径',
          description: '要导入的本地目录路径（后端可读）。',
          minLength: 1,
        },
      },
      required: ['directoryPath'],
      additionalProperties: false,
    },
    diagnostics: null,
    capabilities: {
      supportsSnapshot: true,
      supportsSyncCheck: true,
    },
  },
];

export function getBuiltinConnector(connectorId: string): SourceConnectorDescriptor | undefined {
  return BUILTIN_CONNECTORS.find((c) => c.connectorId === connectorId);
}

export function rootPathKeyForConnector(connectorId: string): string {
  if (connectorId === 'obsidian') return 'vaultPath';
  if (connectorId === 'local-directory') return 'directoryPath';
  return 'directoryPath';
}

/** Normalize legacy snake_case connection config keys to camelCase for storage. */
export function normalizeConnectionConfig(
  connectorId: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...config };
  if (connectorId === 'obsidian') {
    if (typeof normalized.vault_path === 'string' && normalized.vaultPath === undefined) {
      normalized.vaultPath = normalized.vault_path;
    }
    delete normalized.vault_path;
  }
  if (connectorId === 'local-directory') {
    if (typeof normalized.directory_path === 'string' && normalized.directoryPath === undefined) {
      normalized.directoryPath = normalized.directory_path;
    }
    if (typeof normalized.root_path === 'string' && normalized.directoryPath === undefined) {
      normalized.directoryPath = normalized.root_path;
    }
    delete normalized.directory_path;
    delete normalized.root_path;
  }
  return normalized;
}

export function extensionsForConnector(connectorId: string): readonly string[] {
  if (connectorId === 'obsidian') return OBSIDIAN_EXTENSIONS;
  if (connectorId === 'local-directory') return LOCAL_DIRECTORY_EXTENSIONS;
  return [];
}
