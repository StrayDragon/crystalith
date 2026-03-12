#!/usr/bin/env python3
"""API schema management utilities.

Usage:
    uv run scripts/api_schema.py export [--output FILE]
    uv run scripts/api_schema.py check [--schema FILE]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def get_openapi_schema() -> dict:
    """Generate OpenAPI schema from the application (deterministic)."""
    from crystalith.app import create_app

    app = create_app()
    import fastapi._compat.v2 as compat_v2
    import fastapi.openapi.utils as openapi_utils

    def stable_get_compat_model_name_map(  # type: ignore[override]
        fields: list[compat_v2.ModelField],
    ) -> compat_v2.ModelNameMap:
        v2_model_fields = [field for field in fields if isinstance(field, compat_v2.ModelField)]
        flat_models = compat_v2.get_flat_models_from_fields(v2_model_fields, known_models=set())
        ordered_models = sorted(flat_models, key=lambda m: f"{m.__module__}.{m.__qualname__}")
        return compat_v2.get_model_name_map(ordered_models)

    original = openapi_utils.get_compat_model_name_map
    openapi_utils.get_compat_model_name_map = stable_get_compat_model_name_map  # type: ignore[assignment]
    try:
        return app.openapi()
    finally:
        openapi_utils.get_compat_model_name_map = original  # type: ignore[assignment]


def _canonicalize_json(value: Any) -> Any:
    """
    Canonicalize JSON-like data to make schema exports stable across runs.

    FastAPI's OpenAPI schema can contain lists whose ordering may vary depending on
    import/registration order. We sort dict keys and also sort lists by a stable
    JSON representation so that exports and checks are deterministic.
    """
    if isinstance(value, dict):
        return {k: _canonicalize_json(value[k]) for k in sorted(value)}

    if isinstance(value, list):
        items = [_canonicalize_json(v) for v in value]
        return sorted(
            items,
            key=lambda v: json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(",", ":")),
        )

    return value


def export_schema(output_path: Path | None = None) -> None:
    """Export OpenAPI schema to file or stdout."""
    schema = _canonicalize_json(get_openapi_schema())
    schema_json = json.dumps(schema, indent=2, ensure_ascii=False, sort_keys=True)

    if output_path:
        output_path.write_text(schema_json)
        print(f"✓ Schema exported to {output_path}", file=sys.stderr)
    else:
        print(schema_json)


def check_schema(schema_path: Path) -> bool:
    """Check if the schema file matches current API.

    Returns True if schemas match, False otherwise.
    """
    if not schema_path.exists():
        print(f"⚠️  Schema file not found: {schema_path}", file=sys.stderr)
        return False

    current_schema = _canonicalize_json(get_openapi_schema())
    existing_schema = _canonicalize_json(json.loads(schema_path.read_text()))

    if current_schema == existing_schema:
        print("✓ API schema is up to date", file=sys.stderr)
        return True
    else:
        print("⚠️  API schema has changed!", file=sys.stderr)
        print("Run: cd frontend/web && pnpm run api:sync", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="API schema management")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Export command
    export_parser = subparsers.add_parser("export", help="Export OpenAPI schema")
    export_parser.add_argument(
        "--output", "-o", type=Path, help="Output file path (stdout if not specified)"
    )

    # Check command
    check_parser = subparsers.add_parser("check", help="Check schema consistency")
    check_parser.add_argument(
        "--schema",
        "-s",
        type=Path,
        default=Path("../../frontend/web/openapi.gen.json"),
        help="Schema file to check against",
    )

    args = parser.parse_args()

    if args.command == "export":
        export_schema(args.output)
        return 0
    elif args.command == "check":
        return 0 if check_schema(args.schema) else 1

    return 1


if __name__ == "__main__":
    sys.exit(main())
