"""命令系统 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/commands/命令系统.feature", "列出所有命令")
def test_列出所有命令():
    ...

@scenario("../features/commands/命令系统.feature", "包含内置预设命令")
def test_包含内置预设命令():
    ...

@scenario("../features/commands/命令系统.feature", "包含自定义预设命令")
def test_包含自定义预设命令():
    ...

@scenario("../features/commands/命令系统.feature", "命令按触发词排序")
def test_命令按触发词排序():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
