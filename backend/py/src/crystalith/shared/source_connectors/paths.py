from __future__ import annotations

import re
from pathlib import PurePosixPath

_WINDOWS_DRIVE_RE = re.compile(r"^[a-zA-Z]:/")


def normalize_relative_path(raw: str) -> str:
    """
    Normalize a connector-provided path into a safe, relative, "/"-separated form.

    Rules (v1):
    - MUST be relative (no leading "/", no drive letters, no UNC paths)
    - SHALL NOT contain "." or ".." path segments (including "./" or "../" prefixes)
    - Separators are normalized to "/"
    """
    text = (raw or "").strip()
    if not text:
        raise ValueError("relative_path must not be empty")

    normalized_separators = text.replace("\\", "/")

    if _WINDOWS_DRIVE_RE.match(normalized_separators):
        raise ValueError("relative_path must not be an absolute Windows path")
    if normalized_separators.startswith(("//", "/")):
        raise ValueError("relative_path must be a relative path")

    if normalized_separators in {".", ".."} or normalized_separators.startswith(("./", "../")):
        raise ValueError("relative_path must not contain path traversal segments")
    if "/./" in normalized_separators or normalized_separators.endswith("/."):
        raise ValueError("relative_path must not contain path traversal segments")
    if "/../" in normalized_separators or normalized_separators.endswith("/.."):
        raise ValueError("relative_path must not contain path traversal segments")

    parts = PurePosixPath(normalized_separators).parts
    if not parts:
        raise ValueError("relative_path must not be empty")
    if any(part in {".", ".."} for part in parts):
        raise ValueError("relative_path must not contain path traversal segments")

    normalized = "/".join(parts)
    if normalized.startswith(("./", "../", "/")):
        raise ValueError("relative_path must be a relative path")
    return normalized


def normalize_directory_path(raw: str) -> str:
    normalized = normalize_relative_path(raw).rstrip("/")
    if not normalized:
        raise ValueError("directory path must not be empty")
    return normalized


def normalize_file_path(raw: str) -> str:
    normalized = normalize_relative_path(raw).rstrip("/")
    if not normalized:
        raise ValueError("file path must not be empty")
    return normalized


def path_in_scope(
    relative_path: str,
    *,
    include_directories: list[str],
    include_files: list[str],
) -> bool:
    if relative_path in include_files:
        return True

    for directory in include_directories:
        prefix = f"{directory}/"
        if relative_path.startswith(prefix):
            return True

    return False
