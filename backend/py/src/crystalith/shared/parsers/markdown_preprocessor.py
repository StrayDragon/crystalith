from __future__ import annotations

import datetime as dt
import re
from pathlib import PurePosixPath

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError

from crystalith.shared.json_types import JsonDict, JsonValue

from .types import ParseResult
from .utils import chunk_paragraphs

_FRONTMATTER_RE = re.compile(r"\A(?:\ufeff)?---[ \t]*\n(?P<body>.*?)(?:\n|\r\n)---[ \t]*(?:\n|$)", re.DOTALL)
_EMBED_RE = re.compile(r"!\[\[([^\[\]]+?)\]\]")
_WIKILINK_RE = re.compile(r"\[\[([^\[\]]+?)\]\]")
_MARKDOWN_EXTENSIONS = {".md", ".markdown", ".mdx"}


def preprocess_obsidian_markdown(text: str) -> ParseResult:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    body = normalized
    metadata: JsonDict = {}

    frontmatter, body_without_frontmatter = _extract_frontmatter(normalized)
    if frontmatter is not None:
        body = body_without_frontmatter
        if frontmatter:
            metadata["frontmatter"] = frontmatter

    transformed, wikilink_count, embed_count = _replace_obsidian_links(body)
    if wikilink_count or embed_count:
        metadata["markdown_preprocessor"] = {
            "variant": "obsidian",
            "wikilinks": wikilink_count,
            "embeds": embed_count,
        }

    return ParseResult(chunks=chunk_paragraphs(transformed), metadata=metadata)


def _extract_frontmatter(text: str) -> tuple[JsonDict | None, str]:
    match = _FRONTMATTER_RE.match(text)
    if match is None:
        return None, text

    body = text[match.end():].lstrip("\n")
    try:
        _yaml = YAML(typ='safe')
        loaded = _yaml.load(match.group("body"))
    except YAMLError:
        return None, text

    if not isinstance(loaded, dict):
        return {}, body

    frontmatter = _normalize_frontmatter(loaded)
    return frontmatter, body


def _normalize_frontmatter(raw: dict[object, object]) -> JsonDict:
    normalized: JsonDict = {}

    title = _normalize_scalar(raw.get("title"))
    if title is not None:
        normalized["title"] = title

    tags = _normalize_string_list(raw.get("tags"))
    if tags:
        normalized["tags"] = tags

    aliases = _normalize_string_list(raw.get("aliases"))
    if aliases:
        normalized["aliases"] = aliases

    date_value = _normalize_date(raw.get("date"))
    if date_value is not None:
        normalized["date"] = date_value

    return normalized


def _normalize_scalar(value: object) -> str | None:
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return None


def _normalize_string_list(value: object) -> list[JsonValue]:
    if isinstance(value, str):
        trimmed = value.strip()
        return [trimmed] if trimmed else []
    if not isinstance(value, list):
        return []

    items: list[JsonValue] = []
    for entry in value:
        if isinstance(entry, str):
            trimmed = entry.strip()
            if trimmed:
                items.append(trimmed)
    return items


def _normalize_date(value: object) -> str | None:
    if isinstance(value, dt.datetime):
        return value.isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return None


def _replace_obsidian_links(text: str) -> tuple[str, int, int]:
    embed_count = 0
    wikilink_count = 0

    def replace_embed(match: re.Match[str]) -> str:
        nonlocal embed_count
        embed_count += 1
        target, alias = _split_target_and_alias(match.group(1))
        label = alias or target
        return f"[嵌入: {label}]"

    def replace_wikilink(match: re.Match[str]) -> str:
        nonlocal wikilink_count
        wikilink_count += 1
        target, alias = _split_target_and_alias(match.group(1))
        href = _normalize_link_target(target)
        label = alias or target
        return f"[{label}]({href})"

    embedded = _EMBED_RE.sub(replace_embed, text)
    linked = _WIKILINK_RE.sub(replace_wikilink, embedded)
    return linked, wikilink_count, embed_count


def _split_target_and_alias(value: str) -> tuple[str, str | None]:
    parts = value.split("|", 1)
    raw_target = parts[0]
    raw_alias = parts[1] if len(parts) == 2 else None
    target = raw_target.strip()
    alias = raw_alias.strip() if isinstance(raw_alias, str) and raw_alias.strip() else None
    return target, alias


def _normalize_link_target(target: str) -> str:
    anchor = ""
    target_part = target
    if "#" in target:
        target_part, anchor_part = target.split("#", 1)
        target_part = target_part.strip()
        anchor = f"#{anchor_part.strip()}" if anchor_part.strip() else ""

    suffix = PurePosixPath(target_part).suffix.lower()
    normalized_target = target_part if suffix in _MARKDOWN_EXTENSIONS or suffix else f"{target_part}.md"
    if suffix and suffix not in _MARKDOWN_EXTENSIONS:
        normalized_target = target_part
    return f"{normalized_target}{anchor}"
