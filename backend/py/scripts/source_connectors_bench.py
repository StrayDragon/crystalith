from __future__ import annotations

import argparse
import asyncio
import datetime
import os
import random
import tempfile
from pathlib import Path
from time import perf_counter

from crystalith.features.source_connectors.api import _build_sync_candidates
from crystalith.features.source_connectors.schemas import Snapshot, SnapshotEntry
from crystalith.shared.config import Settings
from crystalith.shared.plugins.interfaces import SourceConnectorPlugin


def _pick_connector(kind: str) -> tuple[SourceConnectorPlugin, str]:
    if kind == "obsidian":
        from crystalith_connector_obsidian.plugin import plugin as connector  # noqa: PLC0415

        return connector, "vault_path"
    if kind == "local-directory":
        from crystalith_connector_local_directory.plugin import plugin as connector  # noqa: PLC0415

        return connector, "root_path"
    raise SystemExit(f"unsupported connector kind: {kind!r}")


def _write_note(path: Path, *, title: str, body: str) -> None:
    content = (
        "---\n"
        f"title: {title}\n"
        "tags:\n"
        "  - inbox\n"
        "  - bench\n"
        "aliases: [Bench]\n"
        "date: 2026-03-14\n"
        "---\n\n"
        f"{body}\n"
    )
    path.write_text(content, encoding="utf-8")


def _build_vault(root: Path, *, files: int) -> Path:
    vault = root / "vault"
    notes = vault / "notes"
    notes.mkdir(parents=True, exist_ok=True)

    for idx in range(files):
        _write_note(
            notes / f"note-{idx:05d}.md",
            title=f"Note {idx}",
            body=f"Hello {idx}",
        )
    return vault


def _mutate_vault(vault: Path, *, updates: int, missing: int, added: int, seed: int) -> None:
    notes = vault / "notes"
    candidates = sorted([path for path in notes.glob("note-*.md") if path.is_file()])
    rng = random.Random(seed)

    to_update = rng.sample(candidates, k=min(updates, len(candidates)))
    remaining = [path for path in candidates if path not in set(to_update)]
    to_delete = rng.sample(remaining, k=min(missing, len(remaining)))

    for path in to_update:
        existing = path.read_text(encoding="utf-8", errors="ignore")
        path.write_text(existing + "\nupdated: true\n", encoding="utf-8")
        now = datetime.datetime.now(datetime.UTC).timestamp()
        os.utime(path, (now, now))

    for path in to_delete:
        path.unlink(missing_ok=True)

    start_idx = len(candidates) + 1
    for idx in range(added):
        _write_note(
            notes / f"note-added-{start_idx + idx:05d}.md",
            title=f"Added {idx}",
            body="New note",
        )


async def _snapshot(plugin: SourceConnectorPlugin, *, settings: Settings, connection_config: dict[str, str]) -> Snapshot:
    raw = await plugin.list_snapshot_entries(settings, connection_config=connection_config)
    entries = [SnapshotEntry.model_validate(item) for item in raw]
    return Snapshot(generated_at=datetime.datetime.now(datetime.UTC), entries=entries)


async def _run(args: argparse.Namespace) -> int:
    plugin, key = _pick_connector(str(args.connector))
    settings = Settings()

    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        vault = _build_vault(root, files=int(args.files))
        config = {key: str(vault)}

        started = perf_counter()
        base_snapshot = await _snapshot(plugin, settings=settings, connection_config=config)
        snapshot_ms = (perf_counter() - started) * 1000

        _mutate_vault(
            vault,
            updates=int(args.updates),
            missing=int(args.missing),
            added=int(args.added),
            seed=int(args.seed),
        )

        started = perf_counter()
        current_snapshot = await _snapshot(plugin, settings=settings, connection_config=config)
        current_ms = (perf_counter() - started) * 1000

        started = perf_counter()
        candidates = _build_sync_candidates(base_snapshot=base_snapshot, current_snapshot=current_snapshot)
        diff_ms = (perf_counter() - started) * 1000

        print(f"connector={args.connector}")
        print(f"files={args.files}")
        print(f"base_entries={len(base_snapshot.entries)}")
        print(f"current_entries={len(current_snapshot.entries)}")
        print(f"snapshot_ms={snapshot_ms:.3f}")
        print(f"current_snapshot_ms={current_ms:.3f}")
        print(f"sync_check_diff_ms={diff_ms:.3f}")
        print(f"candidates_added={len(candidates.added)}")
        print(f"candidates_updated={len(candidates.updated)}")
        print(f"candidates_missing={len(candidates.missing)}")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark local source connector snapshot + sync_check diff.")
    parser.add_argument(
        "--connector",
        choices=["obsidian", "local-directory"],
        default="obsidian",
        help="Which connector plugin implementation to benchmark.",
    )
    parser.add_argument("--files", type=int, default=120, help="How many markdown files to generate.")
    parser.add_argument("--updates", type=int, default=10, help="How many files to modify before sync_check.")
    parser.add_argument("--missing", type=int, default=10, help="How many files to delete before sync_check.")
    parser.add_argument("--added", type=int, default=10, help="How many files to add before sync_check.")
    parser.add_argument("--seed", type=int, default=7, help="RNG seed for selecting files to mutate.")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":  # pragma: no cover
    main()

