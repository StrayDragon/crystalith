"""内容精炼 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "段落格式精炼")
def test_段落格式精炼():
    ...


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "要点格式精炼")
def test_要点格式精炼():
    ...


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "结构化格式精炼")
def test_结构化格式精炼():
    ...


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "批量精炼多种格式")
def test_批量精炼多种格式():
    ...


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "不支持的格式返回400")
def test_不支持的格式返回400():
    ...


@pytest.mark.experimental
@scenario("../features/refine/内容精炼.feature", "无来源时精炼返回空引用")
def test_无来源时精炼返回空引用():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
