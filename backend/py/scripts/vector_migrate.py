#!/usr/bin/env python3
"""Migrate legacy SQLite vector store data into embedded Chroma storage."""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
from typing import Iterable

from crystalith.shared.env import CRYSTALITH_DATA_DIR
from crystalith.shared.vector_storage import SQLiteVectorStore
from crystalith.shared.vector_storage.chroma import ChromaVectorStore
from crystalith.shared.vector_storage.migration import migrate_sqlite_to_chroma


def _is_repo_root(path: Path) -> bool:
    markers = [
        path / ".git",
        path / "config" / "app.yaml",
        path / "config" / "app.schema.gen.json",
        path / "backend" / "py" / "pyproject.toml",
        path / "backend" / "py" / "src" / "crystalith",
    ]
    return any(marker.exists() for marker in markers)


def _find_repo_root(candidates: Iterable[Path]) -> Path | None:
    for start in candidates:
        current = start.resolve(strict=False)
        for parent in (current, *current.parents):
            if _is_repo_root(parent):
                return parent
    return None


def _resolve_paths(
    sqlite_path: str | None,
    chroma_path: str | None,
    repo_root: str | None,
    data_dir: str | None,
) -> tuple[Path, Path]:
    sqlite_value = sqlite_path or None
    chroma_value = chroma_path or None

    if sqlite_value and chroma_value:
        return Path(sqlite_value), Path(chroma_value)

    data_dir_value = data_dir or os.environ.get(CRYSTALITH_DATA_DIR)
    if data_dir_value:
        data_root = Path(data_dir_value)
    else:
        root = Path(repo_root) if repo_root else None
        if root is None:
            root = _find_repo_root([Path.cwd(), Path(__file__)])
        if root is None:
            raise FileNotFoundError(
                "Could not locate repo root (missing markers). "
                "Pass --data-dir, --repo-root, or explicit --sqlite-path/--chroma-path."
            )
        data_root = root / "data"

    sqlite_value = sqlite_value or str(data_root / "vectors.db")
    chroma_value = chroma_value or str(data_root / "chroma")
    return Path(sqlite_value), Path(chroma_value)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate SQLite vector store data to embedded Chroma persistence.",
    )
    parser.add_argument(
        "--sqlite-path",
        default=None,
        help="Path to the legacy SQLite vector store file.",
    )
    parser.add_argument(
        "--chroma-path",
        default=None,
        help="Path to the Chroma persistence directory.",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Repo root (used to resolve defaults under ./data).",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="Data directory containing vectors.db (defaults to CRYSTALITH_DATA_DIR or repo_root/data).",
    )
    return parser.parse_args()


async def _run(sqlite_path: Path, chroma_path: Path) -> None:
    if not sqlite_path.exists():
        raise FileNotFoundError(f"SQLite vector store not found: {sqlite_path}")

    source = SQLiteVectorStore(path=sqlite_path)
    target = ChromaVectorStore(path=chroma_path)
    try:
        await migrate_sqlite_to_chroma(source, target)
    finally:
        await source.close()


def main() -> int:
    args = _parse_args()
    sqlite_path, chroma_path = _resolve_paths(
        args.sqlite_path,
        args.chroma_path,
        args.repo_root,
        args.data_dir,
    )
    asyncio.run(_run(sqlite_path, chroma_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
