"""笔记本分析 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/analysis/笔记本分析.feature", "无来源时返回空分析结果")
def test_无来源时返回空分析结果():
    ...

@scenario("../features/analysis/笔记本分析.feature", "有来源时返回分析结果")
def test_有来源时返回分析结果():
    ...

@scenario("../features/analysis/笔记本分析.feature", "不存在的笔记本返回404")
def test_不存在的笔记本返回404():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
