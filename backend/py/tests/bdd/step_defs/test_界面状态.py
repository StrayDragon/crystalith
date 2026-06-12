"""界面状态 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/ui/界面状态.feature", "获取界面状态")
def test_获取界面状态():
    ...

@pytest.mark.experimental  # UI component not registered in test env
@scenario("../features/ui/界面状态.feature", "处理界面事件")
def test_处理界面事件():
    ...

@pytest.mark.experimental  # UI component not registered in test env
@scenario("../features/ui/界面状态.feature", "幂等事件处理")
def test_幂等事件处理():
    ...

@pytest.mark.experimental  # UI component not registered in test env
@scenario("../features/ui/界面状态.feature", "版本冲突返回409")
def test_版本冲突返回409():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
