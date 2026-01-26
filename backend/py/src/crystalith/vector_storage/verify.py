from __future__ import annotations

import argparse
import asyncio
import random
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

from .sqlite import SQLiteVectorStore


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify SQLite -> Chroma vector migration by sampling entries.",
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
    parser.add_argument(
        "--collection-name",
        default="vector_entries",
        help="Chroma collection name used for vector entries.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20,
        help="Number of entries to sample from SQLite.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional random seed for deterministic sampling.",
    )
    return parser.parse_args()


async def _run(
    sqlite_path: str,
    chroma_path: str,
    collection_name: str,
    sample_size: int,
    seed: int | None,
) -> int:
    source_path = Path(sqlite_path)
    if not source_path.exists():
        raise FileNotFoundError(f"SQLite vector store not found: {source_path}")

    source = SQLiteVectorStore(path=source_path)
    try:
        entries = list(await source.entries())
    finally:
        await source.close()

    print(f"SQLite entries: {len(entries)}")
    if not entries:
        print("No entries to verify.")
        return 0

    settings = ChromaSettings(anonymized_telemetry=False)
    client = chromadb.PersistentClient(path=str(Path(chroma_path)), settings=settings)
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    chroma_count = collection.count()
    print(f"Chroma entries: {chroma_count}")

    if seed is not None:
        random.seed(seed)
    sample = entries if sample_size <= 0 else random.sample(entries, min(sample_size, len(entries)))
    sample_ids = [f"{entry.notebook_id}:{entry.source_id}:{entry.chunk_id}" for entry in sample]

    result = collection.get(ids=sample_ids)
    found_ids = set(result.get("ids") or [])
    missing = [entry_id for entry_id in sample_ids if entry_id not in found_ids]

    print(f"Sample size: {len(sample_ids)}")
    print(f"Missing in Chroma: {len(missing)}")
    if missing:
        print("Missing IDs (first 10):")
        for entry_id in missing[:10]:
            print(f"- {entry_id}")
        return 1

    print("Verification OK")
    return 0


def main() -> int:
    args = _parse_args()
    return asyncio.run(
        _run(
            args.sqlite_path,
            args.chroma_path,
            args.collection_name,
            args.sample_size,
            args.seed,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
