"""缓存系统 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "基本的存取操作")
def test_基本的存取操作():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "获取不存在的键")
def test_获取不存在的键():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "TTL 过期")
def test_TTL_过期():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "模式批量失效")
def test_模式批量失效():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "原子递增")
def test_原子递增():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "批量操作")
def test_批量操作():
    ...

@pytest.mark.experimental
@scenario("../features/缓存系统.feature", "删除键")
def test_删除键():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
