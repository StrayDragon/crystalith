"""模板管理 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/templates/模板管理.feature", "内置模板已预置")
def test_内置模板已预置():
    ...

@scenario("../features/templates/模板管理.feature", "创建自定义模板")
def test_创建自定义模板():
    ...

@scenario("../features/templates/模板管理.feature", "获取模板详情")
def test_获取模板详情():
    ...

@scenario("../features/templates/模板管理.feature", "更新自定义模板")
def test_更新自定义模板():
    ...

@scenario("../features/templates/模板管理.feature", "删除自定义模板")
def test_删除自定义模板():
    ...

@scenario("../features/templates/模板管理.feature", "不能修改内置模板")
def test_不能修改内置模板():
    ...

@scenario("../features/templates/模板管理.feature", "不能删除内置模板")
def test_不能删除内置模板():
    ...

@scenario("../features/templates/模板管理.feature", "将笔记本保存为模板")
def test_将笔记本保存为模板():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
