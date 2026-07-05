from __future__ import annotations

import datetime
import os
from pathlib import Path
from typing import ClassVar, cast

from ruamel.yaml import YAML

from crystalith.shared.config import Settings
from crystalith.shared.json_types import JsonDict

_SNAPSHOT_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".md",
        ".markdown",
        ".txt",
        ".csv",
        ".html",
        ".htm",
        ".pdf",
        ".mp3",
        ".wav",
        ".mp4",
    }
)


def _frontmatter_list(value: object) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else None
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            if isinstance(item, str):
                trimmed = item.strip()
                if trimmed:
                    items.append(trimmed)
        return list(dict.fromkeys(items)) or None
    return None


def _frontmatter_date(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, (int, float)):
        try:
            dt = datetime.datetime.fromtimestamp(float(value), tz=datetime.UTC)
            return dt.isoformat()
        except Exception:
            return None
    if isinstance(value, str):
        text = value.strip()
        return text if text else None
    return None


def _extract_frontmatter_summary(path: Path, *, max_bytes: int = 64 * 1024) -> JsonDict:
    try:
        with path.open("rb") as handle:
            raw = handle.read(max_bytes)
    except Exception:
        return {}

    text = raw.decode("utf-8", errors="ignore")
    if not text:
        return {}

    lines = text.splitlines()
    if not lines:
        return {}
    if lines[0].strip() != "---":
        return {}

    end_idx: int | None = None
    for idx in range(1, min(len(lines), 2048)):
        marker = lines[idx].strip()
        if marker in {"---", "..."}:
            end_idx = idx
            break
    if end_idx is None or end_idx <= 1:
        return {}

    yaml_text = "\n".join(lines[1:end_idx]).strip()
    if not yaml_text:
        return {}

    try:
        parsed = YAML(typ='safe').load(yaml_text)
    except Exception:
        return {}

    if not isinstance(parsed, dict):
        return {}

    title_raw = parsed.get("title")
    title = title_raw.strip() if isinstance(title_raw, str) else None
    if title == "":
        title = None

    summary: JsonDict = {}
    if title is not None:
        summary["title"] = title

    tags = _frontmatter_list(parsed.get("tags"))
    if tags is not None:
        summary["tags"] = tags

    aliases = _frontmatter_list(parsed.get("aliases"))
    if aliases is not None:
        summary["aliases"] = aliases

    date_value = _frontmatter_date(parsed.get("date"))
    if date_value is not None:
        summary["date"] = date_value

    return summary


def _resolve_root(connection_config: JsonDict, *, key: str) -> tuple[Path | None, list[JsonDict] | None]:
    raw = connection_config.get(key)
    text = str(raw or "").strip()
    if not text:
        return None, [
            {
                "error_code": "CONFIG_REQUIRED",
                "message": f"缺少必填配置：{key}",
                "hint": "请填写有效的本地目录路径。",
            }
        ]

    root = Path(text).expanduser()
    if not root.exists():
        return None, [
            {
                "error_code": "PATH_NOT_FOUND",
                "message": "目录不存在",
                "hint": "请检查路径是否正确，或确认后端进程有权限访问该目录。",
                "details": {"path": str(root)},
            }
        ]
    if not root.is_dir():
        return None, [
            {
                "error_code": "NOT_A_DIRECTORY",
                "message": "路径不是目录",
                "details": {"path": str(root)},
            }
        ]
    try:
        root.resolve(strict=True)
    except Exception:
        return None, [
            {
                "error_code": "PATH_UNRESOLVABLE",
                "message": "目录路径无法解析",
                "details": {"path": str(root)},
            }
        ]

    return root, None


class LocalDirectoryConnectorPlugin:
    api_version = "v1"

    display_name = "Local Directory"
    description = "从本地目录枚举文件并导入。"
    connection_config_schema: ClassVar[JsonDict] = {
        "type": "object",
        "properties": {
            "root_path": {
                "type": "string",
                "title": "目录路径",
                "description": "要导入的本地目录路径（后端可读）。",
                "minLength": 1,
            }
        },
        "required": ["root_path"],
        "additionalProperties": False,
    }

    supports_snapshot = True
    supports_sync_check = True

    async def get_diagnostics(
        self,
        _settings: Settings,
        *,
        connection_config: JsonDict | None = None,
    ) -> list[JsonDict] | None:
        if connection_config is None:
            return None
        _, diags = _resolve_root(connection_config, key="root_path")
        return diags

    async def list_snapshot_entries(
        self,
        _settings: Settings,
        *,
        connection_config: JsonDict,
    ) -> list[JsonDict]:
        root, diags = _resolve_root(connection_config, key="root_path")
        if root is None:
            raise ValueError(diags[0]["message"] if diags else "Invalid root_path")

        resolved_root = root.resolve(strict=True)
        entries: list[JsonDict] = []

        for dirpath, dirnames, filenames in os.walk(resolved_root, followlinks=False):
            dirnames[:] = [name for name in dirnames if not name.startswith(".")]
            for name in filenames:
                if name.startswith("."):
                    continue
                path = Path(dirpath) / name
                suffix = path.suffix.lower()
                if suffix not in _SNAPSHOT_EXTENSIONS:
                    continue
                try:
                    stat = path.stat()
                except OSError:
                    continue

                rel = path.relative_to(resolved_root).as_posix()
                modified_at = datetime.datetime.fromtimestamp(stat.st_mtime, tz=datetime.UTC).isoformat()
                summary: JsonDict = {}
                if suffix in {".md", ".markdown"}:
                    summary = _extract_frontmatter_summary(path)

                entries.append(
                    {
                        "relative_path": rel,
                        "size_bytes": int(stat.st_size),
                        "modified_at": modified_at,
                        "frontmatter_summary": summary,
                    }
                )

        entries.sort(key=lambda item: cast(str, item.get("relative_path") or ""))
        return entries

    async def read_file_bytes(
        self,
        _settings: Settings,
        *,
        connection_config: JsonDict,
        relative_path: str,
    ) -> bytes:
        root, diags = _resolve_root(connection_config, key="root_path")
        if root is None:
            raise ValueError(diags[0]["message"] if diags else "Invalid root_path")

        resolved_root = root.resolve(strict=True)
        candidate = (resolved_root / relative_path).resolve(strict=True)
        if candidate != resolved_root and resolved_root not in candidate.parents:
            raise ValueError("relative_path escapes root directory")
        if not candidate.is_file():
            raise FileNotFoundError(relative_path)

        suffix = candidate.suffix.lower()
        if suffix not in _SNAPSHOT_EXTENSIONS:
            raise ValueError("unsupported file type")
        return candidate.read_bytes()


plugin = LocalDirectoryConnectorPlugin()
