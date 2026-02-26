from __future__ import annotations

import asyncio
import sys

import pytest

from crystalith.shared.vector_storage.chroma import ChromaVectorStore
from crystalith.shared.vector_storage.migrate import _parse_args as migrate_parse_args
from crystalith.shared.vector_storage.migrate import main as migrate_main
from crystalith.shared.vector_storage.migrate import _run as migrate_run
from crystalith.shared.vector_storage.sqlite import SQLiteVectorStore
from crystalith.shared.vector_storage.verify import _parse_args as verify_parse_args
from crystalith.shared.vector_storage.verify import main as verify_main
from crystalith.shared.vector_storage.verify import _run as verify_run


@pytest.mark.asyncio
async def test_migrate_cli_run_migrates_sqlite_to_chroma(tmp_path) -> None:
    sqlite_path = tmp_path / "vectors.db"
    chroma_path = tmp_path / "chroma"

    sqlite = SQLiteVectorStore(path=sqlite_path)
    await sqlite.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100],
        vectors=[[1.0, 0.0]],
    )
    await sqlite.close()

    await migrate_run(str(sqlite_path), str(chroma_path))

    chroma = ChromaVectorStore(path=chroma_path)
    results = await chroma.search(
        notebook_id=1,
        query_vector=[1.0, 0.0],
        top_k=5,
        min_score=0.0,
    )
    assert results


@pytest.mark.asyncio
async def test_verify_cli_run_returns_success_when_entries_present(tmp_path) -> None:
    sqlite_path = tmp_path / "vectors.db"
    chroma_path = tmp_path / "chroma"

    sqlite = SQLiteVectorStore(path=sqlite_path)
    await sqlite.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100],
        vectors=[[1.0, 0.0]],
    )
    await sqlite.close()

    # Seed the chroma persistence by running the migrate CLI helper.
    await migrate_run(str(sqlite_path), str(chroma_path))

    exit_code = await verify_run(
        str(sqlite_path),
        str(chroma_path),
        "vector_entries",
        sample_size=1,
        seed=0,
    )
    assert exit_code == 0


@pytest.mark.asyncio
async def test_verify_cli_run_returns_failure_when_missing(tmp_path) -> None:
    sqlite_path = tmp_path / "vectors.db"
    chroma_path = tmp_path / "chroma"

    sqlite = SQLiteVectorStore(path=sqlite_path)
    await sqlite.add(
        notebook_id=1,
        source_id=10,
        chunk_ids=[100],
        vectors=[[1.0, 0.0]],
    )
    await sqlite.close()

    exit_code = await verify_run(
        str(sqlite_path),
        str(chroma_path),
        "vector_entries",
        sample_size=1,
        seed=0,
    )
    assert exit_code == 1


@pytest.mark.asyncio
async def test_migrate_cli_run_errors_when_sqlite_missing(tmp_path) -> None:
    with pytest.raises(FileNotFoundError):
        await migrate_run(str(tmp_path / "missing.db"), str(tmp_path / "chroma"))


def test_vector_store_cli_parse_args_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock reason: emulate CLI invocation safely without mutating real process argv.
    monkeypatch.setattr(sys, "argv", ["prog"])
    migrate_args = migrate_parse_args()
    assert migrate_args.sqlite_path == "./data/vectors.db"
    assert migrate_args.chroma_path == "./data/chroma"

    # Mock reason: emulate CLI invocation safely without mutating real process argv.
    monkeypatch.setattr(sys, "argv", ["prog"])
    verify_args = verify_parse_args()
    assert verify_args.sqlite_path == "./data/vectors.db"
    assert verify_args.chroma_path == "./data/chroma"
    assert verify_args.collection_name == "vector_entries"


def test_vector_store_cli_main_roundtrip(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    sqlite_path = tmp_path / "vectors.db"
    chroma_path = tmp_path / "chroma"

    async def _seed() -> None:
        sqlite = SQLiteVectorStore(path=sqlite_path)
        await sqlite.add(
            notebook_id=1,
            source_id=10,
            chunk_ids=[100],
            vectors=[[1.0, 0.0]],
        )
        await sqlite.close()

    asyncio.run(_seed())

    # Mock reason: emulate CLI invocation safely without mutating real process argv.
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "prog",
            "--sqlite-path",
            str(sqlite_path),
            "--chroma-path",
            str(chroma_path),
        ],
    )
    assert migrate_main() == 0

    # Mock reason: emulate CLI invocation safely without mutating real process argv.
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "prog",
            "--sqlite-path",
            str(sqlite_path),
            "--chroma-path",
            str(chroma_path),
            "--sample-size",
            "1",
            "--seed",
            "0",
        ],
    )
    assert verify_main() == 0
