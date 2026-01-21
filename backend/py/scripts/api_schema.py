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


def get_openapi_schema() -> dict:
    """Generate OpenAPI schema from the application."""
    from crystalith.app import create_app

    app = create_app()
    return app.openapi()


def export_schema(output_path: Path | None = None) -> None:
    """Export OpenAPI schema to file or stdout."""
    schema = get_openapi_schema()
    schema_json = json.dumps(schema, indent=2, ensure_ascii=False)

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

    current_schema = get_openapi_schema()
    existing_schema = json.loads(schema_path.read_text())

    # Compare schemas (normalize to avoid formatting differences)
    current_json = json.dumps(current_schema, sort_keys=True)
    existing_json = json.dumps(existing_schema, sort_keys=True)

    if current_json == existing_json:
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
        default=Path("../../frontend/web/openapi.json"),
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
