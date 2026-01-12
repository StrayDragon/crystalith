from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

import pytest

_COMPOSE_FILE = Path(__file__).resolve().parents[5] / "dockers" / "docker-compose.test.yaml"
_CONTAINER_NAME = "crystalith-postgres-test"


def _compose_cmd(*args: str) -> list[str]:
    return ["docker", "compose", "-f", str(_COMPOSE_FILE), *args]


def _wait_for_healthy(timeout_seconds: int = 30) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{json .State.Health.Status}}", _CONTAINER_NAME],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            status = result.stdout.strip().strip('"')
            if status == "healthy":
                return True
            if status == "unhealthy":
                return False
        time.sleep(1)
    return False


@pytest.fixture(scope="session")
def postgres_dsn() -> str:
    dsn = os.getenv("CRYSTALITH_TEST_POSTGRES_DSN")
    manage_compose = False

    if not dsn:
        manage_compose = True
        port = os.getenv("CL_POSTGRES_TEST_PORT", "5433")
        user = os.getenv("CL_POSTGRES_TEST_USER", "crystalith")
        password = os.getenv("CL_POSTGRES_TEST_PASSWORD", "crystalith")
        database = os.getenv("CL_POSTGRES_TEST_DB", "crystalith_test")
        dsn = f"postgresql+asyncpg://{user}:{password}@localhost:{port}/{database}"

    if manage_compose:
        if not _COMPOSE_FILE.exists():
            pytest.skip("Postgres compose file not found")
        try:
            subprocess.run(_compose_cmd("up", "-d"), check=True, capture_output=True, text=True)
        except FileNotFoundError:
            pytest.skip("docker not available")
        except subprocess.CalledProcessError as exc:
            pytest.skip(f"docker compose up failed: {exc}")
        if not _wait_for_healthy():
            subprocess.run(_compose_cmd("down"), check=False, capture_output=True, text=True)
            pytest.skip("Postgres container not healthy")

    try:
        yield dsn
    finally:
        if manage_compose:
            subprocess.run(_compose_cmd("down"), check=False, capture_output=True, text=True)
