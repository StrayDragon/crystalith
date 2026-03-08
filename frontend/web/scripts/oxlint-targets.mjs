const FRONTEND_PREFIX = "frontend/web/";
const SOURCE_FILE_PATTERN = /^src\/(?!api\/generated\/).+\.(?:[cm]?[jt]sx?)$/u;

function normalizePath(filePath) {
  const normalized = filePath.trim().replaceAll("\\", "/");
  return normalized.startsWith(FRONTEND_PREFIX)
    ? normalized.slice(FRONTEND_PREFIX.length)
    : normalized;
}

export function resolveChangedLintTargets({
  trackedPaths = [],
  stagedPaths = [],
  unstagedPaths = [],
  untrackedPaths = [],
}) {
  const targets = [...trackedPaths, ...stagedPaths, ...unstagedPaths, ...untrackedPaths]
    .map(normalizePath)
    .filter(Boolean)
    .filter((filePath) => SOURCE_FILE_PATTERN.test(filePath));

  return [...new Set(targets)].sort((left, right) => left.localeCompare(right));
}
