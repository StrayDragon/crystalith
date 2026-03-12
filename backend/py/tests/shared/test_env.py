from __future__ import annotations

import pytest

from crystalith.shared import env as env_mod


def test_env_docs_are_unique() -> None:
    names = [item.name for item in env_mod.ENV_VAR_DOCS]
    assert names
    assert len(names) == len(set(names))


def test_env_bool_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(env_mod.CRYSTALITH_OUTPUT_REPAIR, raising=False)
    assert env_mod.env_bool(env_mod.CRYSTALITH_OUTPUT_REPAIR, default=False) is False

    monkeypatch.setenv(env_mod.CRYSTALITH_OUTPUT_REPAIR, "1")
    assert env_mod.env_bool(env_mod.CRYSTALITH_OUTPUT_REPAIR, default=False) is True

    monkeypatch.setenv(env_mod.CRYSTALITH_OUTPUT_REPAIR, "false")
    assert env_mod.env_bool(env_mod.CRYSTALITH_OUTPUT_REPAIR, default=True) is False


def test_env_bool_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY, raising=False)
    assert env_mod.env_bool_optional(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY) is None

    monkeypatch.setenv(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY, "0")
    assert env_mod.env_bool_optional(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY) is False

    monkeypatch.setenv(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY, "yes")
    assert env_mod.env_bool_optional(env_mod.CRYSTALITH_RETRIEVAL_MULTI_QUERY) is True


def test_env_int_and_float_invalid_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(env_mod.CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS, "not-an-int")
    assert env_mod.env_int(env_mod.CRYSTALITH_EMBEDDING_CACHE_MAX_TEXTS, default=7) == 7

    monkeypatch.setenv(env_mod.CRYSTALITH_EMBEDDING_CACHE_TTL_S, "not-a-float")
    assert env_mod.env_float(env_mod.CRYSTALITH_EMBEDDING_CACHE_TTL_S, default=1.25) == 1.25
