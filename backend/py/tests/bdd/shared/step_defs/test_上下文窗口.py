"""上下文窗口 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@pytest.mark.experimental
@scenario("../features/上下文窗口.feature", "预算内构建上下文")
def test_预算内构建上下文():
    ...

@pytest.mark.experimental
@scenario("../features/上下文窗口.feature", "超出预算时压缩")
def test_超出预算时压缩():
    ...

@pytest.mark.experimental
@scenario("../features/上下文窗口.feature", "按优先级截断")
def test_按优先级截断():
    ...

@pytest.mark.experimental
@scenario("../features/上下文窗口.feature", "窗口滑动")
def test_窗口滑动():
    ...

@pytest.mark.experimental
@scenario("../features/上下文窗口.feature", "统计信息跟踪")
def test_统计信息跟踪():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
