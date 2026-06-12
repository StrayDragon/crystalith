"""会话管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/sessions/会话管理.feature", "创建会话")
def test_创建会话():
    ...

@scenario("../features/sessions/会话管理.feature", "列出会话")
def test_列出会话():
    ...

@scenario("../features/sessions/会话管理.feature", "更新会话标题")
def test_更新会话标题():
    ...

@scenario("../features/sessions/会话管理.feature", "删除会话")
def test_删除会话():
    ...

@scenario("../features/sessions/会话管理.feature", "跨笔记本访问会话返回404")
def test_跨笔记本访问会话返回404():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
