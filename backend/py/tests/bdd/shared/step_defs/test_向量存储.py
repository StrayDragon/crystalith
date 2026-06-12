"""向量存储 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@pytest.mark.experimental
@scenario("../features/向量存储.feature", "添加并搜索向量")
def test_添加并搜索向量():
    ...

@pytest.mark.experimental
@scenario("../features/向量存储.feature", "按来源过滤搜索")
def test_按来源过滤搜索():
    ...

@pytest.mark.experimental
@scenario("../features/向量存储.feature", "删除来源的向量")
def test_删除来源的向量():
    ...

@pytest.mark.experimental
@scenario("../features/向量存储.feature", "删除笔记本的所有向量")
def test_删除笔记本的所有向量():
    ...

@pytest.mark.experimental
@scenario("../features/向量存储.feature", "列出向量条目")
def test_列出向量条目():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
