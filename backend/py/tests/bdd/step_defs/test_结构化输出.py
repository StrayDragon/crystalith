"""结构化输出 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "生成段落输出")
def test_生成段落输出():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "生成要点输出")
def test_生成要点输出():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "生成结构化输出")
def test_生成结构化输出():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "SLIDES类型被拒绝")
def test_SLIDES类型被拒绝():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "插件依赖类型缺少插件时返回409")
def test_插件依赖类型缺少插件时返回409():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "列出笔记本的所有输出")
def test_列出笔记本的所有输出():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "获取单个输出详情")
def test_获取单个输出详情():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "导出输出为Markdown格式")
def test_导出输出为Markdown格式():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "导出输出为JSON格式")
def test_导出输出为JSON格式():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "删除输出")
def test_删除输出():
    ...


@pytest.mark.experimental
@scenario("../features/outputs/结构化输出.feature", "将输出转换为来源")
def test_将输出转换为来源():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
