"""引用管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/citations/引用管理.feature", "通过分块标识获取引用上下文")
def test_通过分块标识获取引用上下文():
    ...

@scenario("../features/citations/引用管理.feature", "通过来源标识和分块序号获取引用上下文")
def test_通过来源标识和分块序号获取引用上下文():
    ...

@scenario("../features/citations/引用管理.feature", "同时提供两种定位器时返回400")
def test_同时提供两种定位器时返回400():
    ...

@scenario("../features/citations/引用管理.feature", "未提供任何定位器时返回400")
def test_未提供任何定位器时返回400():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
