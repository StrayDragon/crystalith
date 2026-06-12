"""消息管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/messages/消息管理.feature", "创建消息")
def test_创建消息():
    ...

@scenario("../features/messages/消息管理.feature", "列出消息")
def test_列出消息():
    ...

@scenario("../features/messages/消息管理.feature", "消息分页")
def test_消息分页():
    ...

@scenario("../features/messages/消息管理.feature", "发送消息后会话更新时间变化")
def test_发送消息后会话更新时间变化():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
