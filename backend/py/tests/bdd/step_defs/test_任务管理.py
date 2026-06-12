"""任务管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/tasks/任务管理.feature", "获取任务状态")
def test_获取任务状态():
    ...

@scenario("../features/tasks/任务管理.feature", "列出笔记本的任务")
def test_列出笔记本的任务():
    ...

@scenario("../features/tasks/任务管理.feature", "任务不存在时返回404")
def test_任务不存在时返回404():
    ...

@scenario("../features/tasks/任务管理.feature", "取消不存在的任务返回404")
def test_取消不存在的任务返回404():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
