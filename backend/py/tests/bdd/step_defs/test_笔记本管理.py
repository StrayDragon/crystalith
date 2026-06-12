"""笔记本管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/notebooks/笔记本管理.feature", "创建空白笔记本")
def test_创建空白笔记本():
    ...

@scenario("../features/notebooks/笔记本管理.feature", "列出所有笔记本")
def test_列出所有笔记本():
    ...

@scenario("../features/notebooks/笔记本管理.feature", "更新笔记本名称")
def test_更新笔记本名称():
    ...

@scenario("../features/notebooks/笔记本管理.feature", "删除笔记本")
def test_删除笔记本():
    ...

@scenario("../features/notebooks/笔记本管理.feature", "访问不存在的笔记本")
def test_访问不存在的笔记本():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
