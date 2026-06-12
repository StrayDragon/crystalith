"""工作空间 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/workspace/工作空间.feature", "列出工作空间工具及诊断信息")
def test_列出工作空间工具及诊断信息():
    ...

@scenario("../features/workspace/工作空间.feature", "获取工具配置模式")
def test_获取工具配置模式():
    ...

@scenario("../features/workspace/工作空间.feature", "不存在的工具返回404")
def test_不存在的工具返回404():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
