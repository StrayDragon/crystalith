"""模型管理 BDD 步骤定义。"""
from __future__ import annotations

import pytest
from pytest_bdd import scenario

import tests.bdd.公共步骤  # noqa: F401

# ── 场景 ──────────────────────────────────────────────────────────────────────



@scenario("../features/models/模型管理.feature", "列出所有模型")
def test_列出所有模型():
    ...

@scenario("../features/models/模型管理.feature", "按角色筛选模型")
def test_按角色筛选模型():
    ...

@pytest.mark.experimental  # test provider filtered by models API
@scenario("../features/models/模型管理.feature", "获取指定模型详情")
def test_获取指定模型详情():
    ...

@scenario("../features/models/模型管理.feature", "请求不存在的模型")
def test_请求不存在的模型():
    ...


# ── 步骤 ──────────────────────────────────────────────────────────────────────

# 所有步骤均由 tests/bdd/公共步骤.py 提供
