#!/usr/bin/env python3
"""Initialize database tables based on current settings."""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
from typing import Iterable

from crystalith.config import ConfigManager, Settings
from crystalith.db import create_all, create_db_manager


def _find_config_path(candidates: Iterable[Path]) -> Path | None:
    for start in candidates:
        current = start.resolve(strict=False)
        for parent in (current, *current.parents):
            candidate = parent / "config" / "app.yaml"
            if candidate.is_file():
                return candidate
    return None


def _resolve_config_path(args: argparse.Namespace) -> tuple[Path | None, bool]:
    explicit_path = args.config_path or os.environ.get("CRYSTALITH_CONFIG_PATH")
    if explicit_path:
        return Path(explicit_path), True

    config_dir = args.config_dir or os.environ.get("CRYSTALITH_CONFIG_DIR")
    if config_dir:
        return Path(config_dir) / "app.yaml", True

    return _find_config_path([Path.cwd(), Path(__file__)]), False


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initialize Crystalith database tables.")
    parser.add_argument(
        "--config-path",
        default=None,
        help="Path to config/app.yaml (overrides auto-discovery).",
    )
    parser.add_argument(
        "--config-dir",
        default=None,
        help="Directory containing app.yaml (overrides auto-discovery).",
    )
    parser.add_argument(
        "--schema-path",
        default=None,
        help="Optional schema.json path (defaults to config/schema.json).",
    )
    parser.add_argument(
        "--secrets-path",
        default=None,
        help="Optional secrets YAML path (defaults to CRYSTALITH_SECRETS_PATH).",
    )
    parser.add_argument(
        "--no-schema-write",
        action="store_true",
        help="Do not generate schema.json if missing.",
    )
    parser.add_argument(
        "--no-schema-validate",
        action="store_true",
        help="Skip JSON Schema validation.",
    )
    return parser.parse_args()


def _load_settings(args: argparse.Namespace) -> Settings:
    config_path, explicit = _resolve_config_path(args)
    if config_path is None:
        return Settings()

    if explicit and not config_path.is_file():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    schema_path = Path(args.schema_path) if args.schema_path else config_path.parent / "schema.json"
    secrets_path_value = args.secrets_path or os.environ.get("CRYSTALITH_SECRETS_PATH")
    secrets_path = Path(secrets_path_value) if secrets_path_value else None

    manager = ConfigManager(
        config_path=config_path,
        schema_path=schema_path,
        secrets_path=secrets_path,
    )
    if not args.no_schema_write and not schema_path.exists():
        manager.write_schema()
    return manager.load(validate_schema=not args.no_schema_validate)


async def _run(settings: Settings) -> None:
    manager = create_db_manager(settings.database.url)
    await create_all(manager.async_engine)


def main() -> int:
    args = _parse_args()
    settings = _load_settings(args)
    asyncio.run(_run(settings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
