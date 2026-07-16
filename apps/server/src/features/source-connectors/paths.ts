// Path normalization for source connectors — mirrors v1 shared/source_connectors/paths.py

const WINDOWS_DRIVE_RE = /^[a-zA-Z]:\//u;

export function normalizeRelativePath(raw: string): string {
  const text = (raw || '').trim();
  if (!text) throw new Error('relative_path must not be empty');

  const normalizedSeparators = text.replaceAll(/\\/gu, '/');

  if (WINDOWS_DRIVE_RE.test(normalizedSeparators)) {
    throw new Error('relative_path must not be an absolute Windows path');
  }
  if (normalizedSeparators.startsWith('//') || normalizedSeparators.startsWith('/')) {
    throw new Error('relative_path must be a relative path');
  }
  if (
    normalizedSeparators === '.' ||
    normalizedSeparators === '..' ||
    normalizedSeparators.startsWith('./') ||
    normalizedSeparators.startsWith('../')
  ) {
    throw new Error('relative_path must not contain path traversal segments');
  }
  if (normalizedSeparators.includes('/./') || normalizedSeparators.endsWith('/.')) {
    throw new Error('relative_path must not contain path traversal segments');
  }
  if (normalizedSeparators.includes('/../') || normalizedSeparators.endsWith('/..')) {
    throw new Error('relative_path must not contain path traversal segments');
  }

  const parts = normalizedSeparators.split('/').filter((p) => p.length > 0);
  if (!parts.length) throw new Error('relative_path must not be empty');
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('relative_path must not contain path traversal segments');
  }

  const normalized = parts.join('/');
  if (normalized.startsWith('./') || normalized.startsWith('../') || normalized.startsWith('/')) {
    throw new Error('relative_path must be a relative path');
  }
  return normalized;
}

export function normalizeDirectoryPath(raw: string): string {
  const normalized = normalizeRelativePath(raw).replace(/\/+$/u, '');
  if (!normalized) throw new Error('directory path must not be empty');
  return normalized;
}

export function normalizeFilePath(raw: string): string {
  const normalized = normalizeRelativePath(raw).replace(/\/+$/u, '');
  if (!normalized) throw new Error('file path must not be empty');
  return normalized;
}

export function pathInScope(
  relativePath: string,
  includeDirectories: string[],
  includeFiles: string[],
): boolean {
  if (includeFiles.includes(relativePath)) return true;

  for (const directory of includeDirectories) {
    const prefix = `${directory}/`;
    if (relativePath.startsWith(prefix)) return true;
  }

  return false;
}
