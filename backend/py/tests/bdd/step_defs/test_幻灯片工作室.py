"""幻灯片工作室 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/studio/幻灯片工作室.feature", "创建幻灯片草稿")
def test_创建幻灯片草稿():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "获取幻灯片草稿")
def test_获取幻灯片草稿():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "更新幻灯片草稿")
def test_更新幻灯片草稿():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "更新幻灯片大纲")
def test_更新幻灯片大纲():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "更新幻灯片 Markdown")
def test_更新幻灯片_Markdown():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "不存在的幻灯片草稿返回404")
def test_不存在的幻灯片草稿返回404():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "无来源时无法创建草稿")
def test_无来源时无法创建草稿():
    ...

@scenario("../features/studio/幻灯片工作室.feature", "获取最新草稿")
def test_获取最新草稿():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
