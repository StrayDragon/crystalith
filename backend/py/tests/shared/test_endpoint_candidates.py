from __future__ import annotations

import contextlib
import socket
import threading

from crystalith.shared.config.endpoint_candidates import (
    endpoint_hostname,
    endpoint_kind,
    order_endpoint_candidates,
    probe_tcp_endpoint,
    tcp_target_from_endpoint,
)


def test_order_endpoint_candidates_trims_and_dedups() -> None:
    ordered = order_endpoint_candidates(["  a  ", "a", "", "b", "  b", "c"], in_docker=False)
    assert set(ordered) == {"a", "b", "c"}
    assert len(ordered) == 3


def test_order_on_host_prefers_localhost_over_docker_internal() -> None:
    candidates = [
        "http://chromadb:8000",
        "http://127.0.0.1:8001",
        "http://example.com:8000",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=False)
    assert ordered[0] == "http://127.0.0.1:8001"
    assert ordered[-1] == "http://chromadb:8000"


def test_order_in_docker_prefers_docker_internal_over_localhost() -> None:
    candidates = [
        "http://127.0.0.1:8001",
        "http://chromadb:8000",
        "http://example.com:8000",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=True)
    assert ordered[0] == "http://chromadb:8000"
    assert ordered[-1] == "http://127.0.0.1:8001"


def test_order_preserves_declaration_order_within_same_kind() -> None:
    candidates = [
        "http://127.0.0.1:5434",
        "http://127.0.0.1:5432",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=False)
    assert ordered == ["http://127.0.0.1:5434", "http://127.0.0.1:5432"]


def test_order_database_candidates_host_mode() -> None:
    candidates = [
        "postgresql+asyncpg://user:pw@127.0.0.1:5434/db",
        "postgresql+asyncpg://user:pw@postgres:5432/db",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=False)
    assert ordered[0] == "postgresql+asyncpg://user:pw@127.0.0.1:5434/db"


def test_order_database_candidates_docker_mode() -> None:
    candidates = [
        "postgresql+asyncpg://user:pw@127.0.0.1:5434/db",
        "postgresql+asyncpg://user:pw@postgres:5432/db",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=True)
    assert ordered[0] == "postgresql+asyncpg://user:pw@postgres:5432/db"


def test_order_redis_candidates_host_mode() -> None:
    candidates = [
        "redis://127.0.0.1:6380/0",
        "redis://redis:6379/0",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=False)
    assert ordered[0] == "redis://127.0.0.1:6380/0"


def test_order_redis_candidates_docker_mode() -> None:
    candidates = [
        "redis://127.0.0.1:6380/0",
        "redis://redis:6379/0",
    ]
    ordered = order_endpoint_candidates(candidates, in_docker=True)
    assert ordered[0] == "redis://redis:6379/0"


def test_endpoint_hostname_supports_url_and_host_port() -> None:
    assert endpoint_hostname("http://redis:6379/0") == "redis"
    assert endpoint_hostname("redis:6379") == "redis"
    assert endpoint_hostname("") is None


def test_endpoint_kind_classifies_common_hosts() -> None:
    assert endpoint_kind("") == "unknown"
    assert endpoint_kind("localhost") == "host_local"
    assert endpoint_kind("127.0.0.1") == "host_local"
    assert endpoint_kind("8.8.8.8") == "external"
    assert endpoint_kind("redis") == "docker_internal"
    assert endpoint_kind("example.com") == "external"


def test_tcp_target_from_endpoint_infers_default_ports() -> None:
    http_with_port = tcp_target_from_endpoint("http://example.com:1234")
    assert http_with_port is not None
    assert http_with_port.port == 1234

    pg = tcp_target_from_endpoint("postgresql+asyncpg://user:pw@db/test")
    assert pg is not None
    assert pg.host == "db"
    assert pg.port == 5432

    redis = tcp_target_from_endpoint("redis://localhost/0")
    assert redis is not None
    assert redis.host == "localhost"
    assert redis.port == 6379

    http = tcp_target_from_endpoint("http://example.com")
    assert http is not None
    assert http.port == 80

    https = tcp_target_from_endpoint("https://example.com")
    assert https is not None
    assert https.port == 443

    host_port = tcp_target_from_endpoint("localhost:1234")
    assert host_port is not None
    assert host_port.host == "localhost"
    assert host_port.port == 1234

    assert tcp_target_from_endpoint("smtp://example.com") is None
    assert tcp_target_from_endpoint(":1234") is None
    assert tcp_target_from_endpoint("localhost:not-a-port") is None

    assert tcp_target_from_endpoint("not-a-host") is None


def test_probe_tcp_endpoint_reports_invalid_endpoints() -> None:
    ok, error = probe_tcp_endpoint("not-a-host", timeout_s=0.1)
    assert ok is False
    assert error == "invalid endpoint"


def test_probe_tcp_endpoint_succeeds_when_port_is_open() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.listen(5)

    stop = threading.Event()

    def _accept_loop() -> None:
        while not stop.is_set():
            try:
                sock.settimeout(0.1)
                conn, _addr = sock.accept()
                conn.close()
            except TimeoutError:
                continue
            except OSError:
                break

    thread = threading.Thread(target=_accept_loop, daemon=True)
    thread.start()

    try:
        ok, error = probe_tcp_endpoint(f"http://127.0.0.1:{port}", timeout_s=0.2)
        assert ok is True
        assert error is None
    finally:
        stop.set()
        with contextlib.suppress(OSError):
            sock.close()


def test_probe_tcp_endpoint_reports_oserror_when_port_is_closed() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()

    ok, error = probe_tcp_endpoint(f"http://127.0.0.1:{port}", timeout_s=0.2)
    assert ok is False
    assert isinstance(error, str)
