"""来源管理 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/sources/来源管理.feature", "列出来源")
def test_列出来源():
    ...

@scenario("../features/sources/来源管理.feature", "删除单个来源")
def test_删除单个来源():
    ...

@scenario("../features/sources/来源管理.feature", "批量删除来源")
def test_批量删除来源():
    ...

@pytest.mark.experimental  # dedup_key not set in test fixture
@scenario("../features/sources/来源管理.feature", "来源去重提示")
def test_来源去重提示():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
