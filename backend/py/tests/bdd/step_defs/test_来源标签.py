"""来源标签 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/sources/来源标签.feature", "创建标签")
def test_创建标签():
    ...

@scenario("../features/sources/来源标签.feature", "列出标签")
def test_列出标签():
    ...

@scenario("../features/sources/来源标签.feature", "重命名标签")
def test_重命名标签():
    ...

@scenario("../features/sources/来源标签.feature", "删除标签")
def test_删除标签():
    ...

@scenario("../features/sources/来源标签.feature", "重复标签名返回409")
def test_重复标签名返回409():
    ...

@scenario("../features/sources/来源标签.feature", "将标签分配给来源")
def test_将标签分配给来源():
    ...

@scenario("../features/sources/来源标签.feature", "从来源移除标签")
def test_从来源移除标签():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
