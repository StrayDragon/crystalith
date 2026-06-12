"""知识问答 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "无来源时提问返回无证据回答")
def test_无来源时提问返回无证据回答():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "有来源时提问触发RAG流程")
def test_有来源时提问触发RAG流程():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "指定source_ids过滤来源提问")
def test_指定source_ids过滤来源提问():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "使用stats预设提问")
def test_使用stats预设提问():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "使用已禁用的预设提问失败")
def test_使用已禁用的预设提问失败():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "使用未知预设提问失败")
def test_使用未知预设提问失败():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "流式提问返回SSE事件")
def test_流式提问返回SSE事件():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "无来源时流式提问返回无证据SSE事件")
def test_无来源时流式提问返回无证据SSE事件():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "导出QA为Markdown格式")
def test_导出QA为Markdown格式():
    ...


@pytest.mark.experimental
@scenario("../features/qa/知识问答.feature", "导出QA为JSON格式")
def test_导出QA为JSON格式():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
