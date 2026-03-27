from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Snapshot:
    thread_id: str
    seq: int
    shared_state: dict[str, Any]
    created_at_ms: int


class SqliteSnapshotStore:
    def __init__(self, path: str | Path) -> None:
        self._path = str(path)
        self._init_db()

    @property
    def path(self) -> str:
        return self._path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        Path(self._path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS rivu_snapshots (
                  thread_id TEXT NOT NULL,
                  seq INTEGER NOT NULL,
                  snapshot_json TEXT NOT NULL,
                  created_at_ms INTEGER NOT NULL,
                  PRIMARY KEY(thread_id, seq)
                )
                """,
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_rivu_snapshots_thread_seq ON rivu_snapshots(thread_id, seq)",
            )

    def put(self, *, thread_id: str, seq: int, shared_state: dict[str, Any]) -> None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        if not isinstance(seq, int) or seq <= 0:
            raise ValueError("seq must be a positive int")
        if not isinstance(shared_state, dict):
            raise ValueError("shared_state must be a dict")

        created_at_ms = int(time.time() * 1000)
        payload = json.dumps(shared_state, ensure_ascii=False, separators=(",", ":"))
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO rivu_snapshots(thread_id, seq, snapshot_json, created_at_ms) VALUES (?,?,?,?)",
                (thread_id, seq, payload, created_at_ms),
            )

    def get_latest(self, *, thread_id: str) -> Snapshot | None:
        if not thread_id.strip():
            raise ValueError("thread_id must be non-empty")
        with self._connect() as conn:
            row = conn.execute(
                "SELECT seq, snapshot_json, created_at_ms FROM rivu_snapshots WHERE thread_id=? ORDER BY seq DESC LIMIT 1",
                (thread_id,),
            ).fetchone()
        if not row:
            return None
        seq, snapshot_json, created_at_ms = row
        shared_state = json.loads(snapshot_json)
        if not isinstance(shared_state, dict):
            raise ValueError("stored snapshot is not an object")
        return Snapshot(thread_id=thread_id, seq=int(seq), shared_state=shared_state, created_at_ms=int(created_at_ms))
