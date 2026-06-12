"""AI提供者 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@pytest.mark.experimental
@scenario("../features/AI提供者.feature", "文本嵌入")
def test_文本嵌入():
    ...

@pytest.mark.experimental
@scenario("../features/AI提供者.feature", "对话补全")
def test_对话补全():
    ...

@pytest.mark.experimental
@scenario("../features/AI提供者.feature", "对话流式输出")
def test_对话流式输出():
    ...

@pytest.mark.experimental
@scenario("../features/AI提供者.feature", "批量文本嵌入")
def test_批量文本嵌入():
    ...

@pytest.mark.experimental
@scenario("../features/AI提供者.feature", "错误重试")
def test_错误重试():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
