"""并发控制 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@pytest.mark.experimental
@scenario("../features/并发控制.feature", "获取和释放限制器")
def test_获取和释放限制器():
    ...

@pytest.mark.experimental
@scenario("../features/并发控制.feature", "限制为0表示无限制")
def test_限制为0表示无限制():
    ...

@pytest.mark.experimental
@scenario("../features/并发控制.feature", "指标快照")
def test_指标快照():
    ...

@pytest.mark.experimental
@scenario("../features/并发控制.feature", "多个独立限制器")
def test_多个独立限制器():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
