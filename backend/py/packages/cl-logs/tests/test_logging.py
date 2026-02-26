import logging
from collections.abc import Iterator

import pytest

from cl_logs import (
    LogConfig,
    configure_logging_once,
    create_third_party_levels,
    detect_json_output,
    reset_logging_state,
    temporary_logging_config,
)


@pytest.fixture(autouse=True)
def _reset_logging_state() -> Iterator[None]:
    reset_logging_state()
    yield
    reset_logging_state()


def test_detect_json_output_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock reason: environment toggles are the contract under test for output format selection.
    monkeypatch.setenv("LOGX_FORMAT", "json")
    assert detect_json_output(False) is True

    monkeypatch.setenv("LOGX_FORMAT", "console")
    assert detect_json_output(True) is False

    # Mock reason: docker env fallback behavior is part of the same env-driven decision contract.
    monkeypatch.delenv("LOGX_FORMAT")
    monkeypatch.setenv("RUNNING_IN_DOCKER", "true")
    assert detect_json_output() is True


def test_create_third_party_levels_override() -> None:
    levels = create_third_party_levels({"custom": "debug"})
    assert levels["custom"] == logging.DEBUG


def test_temporary_logging_config_allows_reconfigure(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_logging_once(LogConfig(level="INFO", use_json=False))

    with temporary_logging_config(LogConfig(level="DEBUG", enable_rich=False, use_json=False)):
        assert detect_json_output(False) is False

    # 退出上下文后仍可以重新配置
    configure_logging_once(LogConfig(level="WARNING", use_json=False))
