"""提示词预设 BDD 步骤定义。"""
from __future__ import annotations

from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/prompt_presets/提示词预设.feature", "列出所有预设包含内置和自定义")
def test_列出所有预设包含内置和自定义():
    ...

@scenario("../features/prompt_presets/提示词预设.feature", "创建自定义预设")
def test_创建自定义预设():
    ...

@scenario("../features/prompt_presets/提示词预设.feature", "触发词与内置预设冲突返回409")
def test_触发词与内置预设冲突返回409():
    ...

@scenario("../features/prompt_presets/提示词预设.feature", "触发词重复返回409")
def test_触发词重复返回409():
    ...

@scenario("../features/prompt_presets/提示词预设.feature", "更新自定义预设")
def test_更新自定义预设():
    ...

@scenario("../features/prompt_presets/提示词预设.feature", "删除自定义预设")
def test_删除自定义预设():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
