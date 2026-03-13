#!/usr/bin/env python3
"""Generate controlled docs-site reference pages and injected blocks."""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import tomllib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GeneratedTarget:
    path: Path
    content: str


GENERATOR_ID = "backend/py/scripts/gen_docs.py"
JUST_ENTRYPOINT = "just gen-docs"
CONFIG_SCHEMA_MAX_DEPTH = 5

_AUTOGEN_BEGIN_RE = re.compile(r"^\s*<!--\s*BEGIN\s+AUTOGEN:(?P<id>[a-z0-9][a-z0-9._/-]*)\s*-->\s*$")
_AUTOGEN_END_RE = re.compile(r"^\s*<!--\s*END\s+AUTOGEN:(?P<id>[a-z0-9][a-z0-9._/-]*)\s*-->\s*$")


def _repo_root() -> Path:
    start = Path(__file__).resolve()
    for parent in (start, *start.parents):
        if (parent / "justfile").is_file() and (parent / "openspec").is_dir():
            return parent
    raise FileNotFoundError("Could not locate repo root (missing justfile/openspec markers).")


def _docs_root(*, repo_root: Path) -> Path:
    config_path = repo_root / "docs" / "zensical.toml"
    if not config_path.is_file():
        raise FileNotFoundError(f"Missing docs config: {config_path}")

    payload = tomllib.loads(config_path.read_text(encoding="utf-8"))
    project = payload.get("project")
    if not isinstance(project, dict):
        raise ValueError(f"{config_path} missing required [project] table")

    docs_dir = project.get("docs_dir")
    if not isinstance(docs_dir, str) or not docs_dir.strip():
        raise ValueError(f"{config_path} missing required project.docs_dir")

    docs_base = config_path.parent.resolve()
    docs_root = (docs_base / Path(docs_dir)).resolve()
    if not docs_root.is_relative_to(docs_base):
        raise ValueError(f"{config_path} project.docs_dir must resolve under {docs_base} (got: {docs_root})")
    if not docs_root.is_dir():
        raise FileNotFoundError(f"{config_path} project.docs_dir does not exist: {docs_root}")

    return docs_root


def _ensure_trailing_newline(text: str) -> str:
    return text if text.endswith("\n") else text + "\n"


def _render_generated_header(*, source: str) -> str:
    return _ensure_trailing_newline(
        "\n".join(
            [
                "<!--",
                "AUTO-GENERATED. DO NOT EDIT BY HAND.",
                f"Generator: {GENERATOR_ID} (run: {JUST_ENTRYPOINT})",
                f"Source: {source}",
                "-->",
                "",
            ]
        )
    )


def _diff_text(path: Path, old: str, new: str) -> str:
    return "\n".join(
        difflib.unified_diff(
            old.splitlines(),
            new.splitlines(),
            fromfile=str(path),
            tofile=str(path),
            lineterm="",
        )
    )


def _write_or_check(target: GeneratedTarget, *, check: bool) -> bool:
    desired = _ensure_trailing_newline(target.content)
    existing = target.path.read_text(encoding="utf-8") if target.path.is_file() else ""
    if existing == desired:
        return True

    if check:
        print(_diff_text(target.path, existing, desired), file=sys.stderr)
        return False

    target.path.parent.mkdir(parents=True, exist_ok=True)
    target.path.write_text(desired, encoding="utf-8")
    print(f"✓ wrote {target.path}", file=sys.stderr)
    return True


def _compact_description(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _resolve_json_pointer(root: dict[str, object], pointer: str) -> dict[str, object]:
    if not pointer.startswith("#/"):
        return {}
    current: object = root
    for part in pointer.removeprefix("#/").split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, dict):
            return {}
        current = current.get(key)
    return current if isinstance(current, dict) else {}


def _resolve_schema(schema: dict[str, object], *, root: dict[str, object]) -> dict[str, object]:
    seen: set[str] = set()
    current: dict[str, object] = schema
    while "$ref" in current:
        ref_value = current.get("$ref")
        if not isinstance(ref_value, str) or ref_value in seen:
            break
        seen.add(ref_value)
        resolved = _resolve_json_pointer(root, ref_value)
        if not resolved:
            break
        current = resolved
    return current


def _schema_type(schema: dict[str, object]) -> str:
    if "type" in schema:
        value = schema.get("type")
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            items = [item for item in value if isinstance(item, str)]
            return "|".join(items) if items else "unknown"
    if "enum" in schema:
        return "enum"
    if "anyOf" in schema:
        return "anyOf"
    if "oneOf" in schema:
        return "oneOf"
    if "allOf" in schema:
        return "allOf"
    if "$ref" in schema:
        return "ref"
    return "unknown"


def _render_config_schema_reference(*, repo_root: Path, docs_root: Path) -> GeneratedTarget:
    schema_path = repo_root / "config/app.schema.gen.json"
    payload_raw = json.loads(schema_path.read_text(encoding="utf-8"))
    payload = payload_raw if isinstance(payload_raw, dict) else {}
    properties = payload.get("properties") or {}
    if not isinstance(properties, dict):
        properties = {}

    rel_source = schema_path.relative_to(repo_root).as_posix()
    lines: list[str] = []
    lines.append(_render_generated_header(source=rel_source).rstrip("\n"))
    lines.append("# Configuration Schema Reference (Generated)")
    lines.append("")
    lines.append(f"SSOT: `{rel_source}`")
    lines.append("")
    lines.append("Regeneration:")
    lines.append("- Config schema: `cd backend/py && just config-schema`")
    lines.append(f"- Docs reference: `{JUST_ENTRYPOINT}`")
    lines.append("")
    lines.append(f"## Key paths (max depth: {CONFIG_SCHEMA_MAX_DEPTH})")
    lines.append("")
    lines.append("| Path | Type | Description |")
    lines.append("| --- | --- | --- |")

    def _iter_nodes(
        schema_obj: dict[str, object],
        *,
        prefix: str,
        depth: int,
    ) -> list[tuple[str, dict[str, object]]]:
        resolved = _resolve_schema(schema_obj, root=payload)
        nodes: list[tuple[str, dict[str, object]]] = [(prefix, resolved)]
        if depth <= 0:
            return nodes
        if resolved.get("type") == "object" and isinstance(resolved.get("properties"), dict):
            child_props = resolved.get("properties") or {}
            assert isinstance(child_props, dict)
            for child_key in sorted([k for k in child_props.keys() if isinstance(k, str)]):
                child_value = child_props.get(child_key)
                if not isinstance(child_value, dict):
                    continue
                child_prefix = f"{prefix}.{child_key}" if prefix else child_key
                nodes.extend(_iter_nodes(child_value, prefix=child_prefix, depth=depth - 1))
        return nodes

    rows: list[tuple[str, str, str]] = []
    for top_key in sorted([k for k in properties.keys() if isinstance(k, str)]):
        top_schema = properties.get(top_key)
        if not isinstance(top_schema, dict):
            continue
        for path, node_schema in _iter_nodes(top_schema, prefix=top_key, depth=CONFIG_SCHEMA_MAX_DEPTH - 1):
            desc = _compact_description(node_schema.get("description"))
            rows.append((path, _schema_type(node_schema), desc))

    for path, typ, desc in rows:
        desc_cell = desc.replace("|", "\\|")
        lines.append(f"| `{path}` | `{typ}` | {desc_cell} |")
    lines.append("")

    out_path = docs_root / "reference/config-schema.gen.md"
    return GeneratedTarget(path=out_path, content="\n".join(lines))


def _render_env_vars_reference(*, repo_root: Path, docs_root: Path) -> GeneratedTarget:
    from crystalith.shared.env import ENV_VAR_DOCS  # local import: keep generator startup fast

    config_path = repo_root / "config/app.yaml"
    config_text = config_path.read_text(encoding="utf-8")
    env_pattern = re.compile(r"\$\{\{\s*env\.([A-Z0-9_]+)\s*\}\}")

    config_env_vars: list[str] = []
    try:
        import yaml

        payload = yaml.safe_load(config_text) or {}
        found: set[str] = set()

        def _collect(value: object) -> None:
            if isinstance(value, str):
                for match in env_pattern.finditer(value):
                    found.add(match.group(1))
                return
            if isinstance(value, list):
                for item in value:
                    _collect(item)
                return
            if isinstance(value, dict):
                for item in value.values():
                    _collect(item)
                return

        _collect(payload)
        config_env_vars = sorted(found)
    except Exception:
        config_env_vars = sorted(set(env_pattern.findall(config_text)))

    lines: list[str] = []
    lines.append(_render_generated_header(source="backend/py/src/crystalith/shared/env.py + config/app.yaml").rstrip("\n"))
    lines.append("# Environment Variables Reference (Generated)")
    lines.append("")
    lines.append("This page documents supported environment variables that affect runtime behavior and configuration.")
    lines.append("")
    lines.append("Regeneration:")
    lines.append(f"- `{JUST_ENTRYPOINT}`")
    lines.append("")

    lines.append("## Backend runtime env vars (supported)")
    lines.append("")
    lines.append("SSOT: `backend/py/src/crystalith/shared/env.py`")
    lines.append("")
    lines.append("| Name | Type | Default | Description |")
    lines.append("| --- | --- | --- | --- |")
    for item in sorted(ENV_VAR_DOCS, key=lambda ev: ev.name):
        default = "" if item.default is None else str(item.default)
        desc = _compact_description(item.description).replace("|", "\\|")
        lines.append(f"| `{item.name}` | `{item.type}` | `{default}` | {desc} |")
    lines.append("")

    lines.append("## Config interpolation env vars (referenced by `config/app.yaml`)")
    lines.append("")
    lines.append("These env vars are referenced via `${{ env.* }}` in the default config file.")
    lines.append("")
    if config_env_vars:
        for name in config_env_vars:
            lines.append(f"- `{name}`")
    else:
        lines.append("- (none)")
    lines.append("")

    out_path = docs_root / "reference/env-vars.gen.md"
    return GeneratedTarget(path=out_path, content="\n".join(lines))


def _render_plugins_reference(*, repo_root: Path, docs_root: Path) -> GeneratedTarget:
    from crystalith.shared.plugins.interfaces import PLUGIN_API_VERSION
    from crystalith.shared.plugins.official_catalog import OFFICIAL_PLUGIN_CATALOG

    lines: list[str] = []
    lines.append(
        _render_generated_header(source="backend/py/src/crystalith/shared/plugins/official_catalog.py").rstrip("\n")
    )
    lines.append("# Official Plugins Catalog (Generated)")
    lines.append("")
    lines.append("This page lists official, optional capability plugins shipped with Crystalith.")
    lines.append("")
    lines.append(f"Host plugin API version: `{PLUGIN_API_VERSION}`")
    lines.append("")
    lines.append("SSOT: `backend/py/src/crystalith/shared/plugins/official_catalog.py`")
    lines.append("")
    lines.append("| Plugin ID | Kind | Package | Install hint |")
    lines.append("| --- | --- | --- | --- |")

    for plugin_id in sorted(OFFICIAL_PLUGIN_CATALOG.keys()):
        entry = OFFICIAL_PLUGIN_CATALOG[plugin_id]
        hint = _compact_description(entry.default_install_hint()).replace("|", "\\|")
        lines.append(f"| `{entry.plugin_id}` | `{entry.kind}` | `{entry.package}` | {hint} |")
    lines.append("")

    lines.append("Enable/disable via `config/app.yaml`:")
    lines.append("")
    lines.append("```yaml")
    lines.append("plugins:")
    lines.append("  enabled: [\"output-faq\", \"parser-pdf\"]  # allowlist (optional)")
    lines.append("  disabled: [\"extractor-jina\"]           # denylist (always applied)")
    lines.append("```")
    lines.append("")

    out_path = docs_root / "reference/plugins.gen.md"
    return GeneratedTarget(path=out_path, content="\n".join(lines))


_AUTOGEN_RENDERERS: dict[str, Callable[[Path], str]] = {}


def _apply_autogen_blocks(*, path: Path, text: str, repo_root: Path) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    idx = 0

    while idx < len(lines):
        begin_match = _AUTOGEN_BEGIN_RE.match(lines[idx])
        if not begin_match:
            out.append(lines[idx])
            idx += 1
            continue

        block_id = begin_match.group("id")
        renderer = _AUTOGEN_RENDERERS.get(block_id)
        if renderer is None:
            raise ValueError(f"Unknown AUTOGEN block id '{block_id}' in {path}")

        out.append(lines[idx])  # BEGIN marker line
        idx += 1

        inner_start = idx
        while idx < len(lines) and not _AUTOGEN_END_RE.match(lines[idx]):
            idx += 1
        if idx >= len(lines):
            raise ValueError(f"Missing END AUTOGEN:{block_id} marker in {path}")

        end_match = _AUTOGEN_END_RE.match(lines[idx])
        assert end_match is not None
        if end_match.group("id") != block_id:
            raise ValueError(
                f"Mismatched AUTOGEN markers in {path}: BEGIN={block_id} END={end_match.group('id')}"
            )

        desired_inner = renderer(repo_root)
        if "<!-- BEGIN AUTOGEN:" in desired_inner or "<!-- END AUTOGEN:" in desired_inner:
            raise ValueError(f"AUTOGEN renderer '{block_id}' produced nested markers (not allowed).")

        out.append(_ensure_trailing_newline(desired_inner))
        out.append(lines[idx])  # END marker line
        idx += 1

        _ = inner_start  # (reserved) keep parsing state obvious

    return "".join(out)


def _inject_or_check_autogen_blocks(*, repo_root: Path, docs_root: Path, check: bool) -> bool:
    ok = True
    for path in sorted(docs_root.rglob("*.md")):
        if path.name.endswith(".gen.md"):
            continue
        raw = path.read_text(encoding="utf-8")
        if "BEGIN AUTOGEN:" not in raw:
            continue

        desired = _apply_autogen_blocks(path=path, text=raw, repo_root=repo_root)
        if desired == raw:
            continue

        if check:
            print(_diff_text(path, raw, desired), file=sys.stderr)
            ok = False
            continue

        path.write_text(_ensure_trailing_newline(desired), encoding="utf-8")
        print(f"✓ injected {path}", file=sys.stderr)

    return ok


def _main() -> int:
    parser = argparse.ArgumentParser(description="Generate docs-site reference pages and injected blocks.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check for drift without writing files (non-zero exit on differences).",
    )
    args = parser.parse_args()

    repo_root = _repo_root()
    docs_root = _docs_root(repo_root=repo_root)

    targets: list[GeneratedTarget] = [
        _render_config_schema_reference(repo_root=repo_root, docs_root=docs_root),
        _render_env_vars_reference(repo_root=repo_root, docs_root=docs_root),
        _render_plugins_reference(repo_root=repo_root, docs_root=docs_root),
    ]

    ok = True
    for target in targets:
        ok = _write_or_check(target, check=args.check) and ok

    ok = _inject_or_check_autogen_blocks(repo_root=repo_root, docs_root=docs_root, check=args.check) and ok

    if not ok and args.check:
        print(f"Docs drift detected. Fix by running: {JUST_ENTRYPOINT}", file=sys.stderr)
        return 1

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(_main())
