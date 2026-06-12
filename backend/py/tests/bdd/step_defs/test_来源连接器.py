"""来源连接器 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/source_connectors/来源连接器.feature", "列出可用连接器")
def test_列出可用连接器():
    ...

@scenario("../features/source_connectors/来源连接器.feature", "创建连接器绑定")
def test_创建连接器绑定():
    ...

@scenario("../features/source_connectors/来源连接器.feature", "获取绑定快照")
def test_获取绑定快照():
    ...

@scenario("../features/source_connectors/来源连接器.feature", "执行同步检查")
def test_执行同步检查():
    ...

@scenario("../features/source_connectors/来源连接器.feature", "设置导入范围")
def test_设置导入范围():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
