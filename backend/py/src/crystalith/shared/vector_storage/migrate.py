from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from .chroma import ChromaVectorStore
from .migration import migrate_sqlite_to_chroma
from .sqlite import SQLiteVectorStore


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate SQLite vector store data to embedded Chroma persistence.",
    )
    parser.add_argument(
        "--sqlite-path",
        default="./data/vectors.db",
        help="Path to the legacy SQLite vector store file.",
    )
    parser.add_argument(
        "--chroma-path",
        default="./data/chroma",
        help="Path to the Chroma persistence directory.",
    )
    return parser.parse_args()


async def _run(sqlite_path: str, chroma_path: str) -> None:
    source_path = Path(sqlite_path)
    if not source_path.exists():
        raise FileNotFoundError(f"SQLite vector store not found: {source_path}")

    source = SQLiteVectorStore(path=source_path)
    target = ChromaVectorStore(path=chroma_path)
    try:
        await migrate_sqlite_to_chroma(source, target)
    finally:
        await source.close()


def main() -> int:
    args = _parse_args()
    asyncio.run(_run(args.sqlite_path, args.chroma_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
