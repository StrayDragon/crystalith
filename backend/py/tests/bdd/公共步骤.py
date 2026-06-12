"""公共 BDD 步骤定义。

所有 feature 文件共享的 Given / When / Then 步骤。
步骤名称使用中文，与 feature 文件中的场景描述保持一致。

注意：步骤函数均为同步（pytest-bdd 8.x 不支持 async 步骤），
通过 event_loop fixture + run_until_complete() 运行异步操作。
"""
from __future__ import annotations

import json as _json
import re as _re

import pytest
from pytest_bdd import given, parsers, then, when


def _resolve_path(path: str, request) -> str:
    """解析 URL 路径中的 {fixture[key]} 模板变量。

    例如: "/v1/tasks/{任务[id]}" → "/v1/tasks/42"
    """
    def _replacer(match: _re.Match) -> str:
        fixture_name = match.group(1)
        key = match.group(2)
        try:
            value = request.getfixturevalue(fixture_name)
            return str(value[key])
        except Exception:
            return match.group(0)
    return _re.sub(r'\{(\w+)\[(\w+)\]\}', _replacer, path)


# ══════════════════════════════════════════════════════════════════════════════
# Given — 前置条件
# ══════════════════════════════════════════════════════════════════════════════


@given("已启动应用")
def 已启动应用(client):
    """确认 ASGI 测试客户端可用（由 conftest 的 client fixture 提供）。"""
    assert client is not None


@given("一个空白笔记本", target_fixture="当前笔记本")
def 创建空白笔记本(client, event_loop):
    响应 = event_loop.run_until_complete(
        client.post("/v1/notebooks", json={"name": "测试笔记本"})
    )
    assert 响应.status_code == 201, f"创建笔记本失败: {响应.text}"
    return 响应.json()


@given(parsers.parse('一个名为"{名称}"的笔记本'), target_fixture="当前笔记本")
def 创建命名笔记本(client, event_loop, 名称):
    响应 = event_loop.run_until_complete(
        client.post("/v1/notebooks", json={"name": 名称})
    )
    assert 响应.status_code == 201, f"创建笔记本失败: {响应.text}"
    return 响应.json()


@given(parsers.parse('笔记本"{名称}"已存在'), target_fixture="当前笔记本")
def 笔记本已存在(client, event_loop, 名称):
    响应 = event_loop.run_until_complete(
        client.post("/v1/notebooks", json={"name": 名称})
    )
    assert 响应.status_code == 201, f"创建笔记本失败: {响应.text}"
    return 响应.json()


@given("一个空白会话", target_fixture="当前会话")
def 创建空白会话(client, event_loop, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions",
            json={"title": "测试会话"},
        )
    )
    assert 响应.status_code == 201, f"创建会话失败: {响应.text}"
    return 响应.json()


@given(parsers.parse('一个名为"{标题}"的会话'), target_fixture="当前会话")
def 创建命名会话(client, event_loop, 当前笔记本, 标题):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions",
            json={"title": 标题},
        )
    )
    assert 响应.status_code == 201, f"创建会话失败: {响应.text}"
    return 响应.json()


@given(parsers.parse('笔记本中有一篇来源"{文件名}"'), target_fixture="当前来源")
def 添加一篇来源(event_loop, db_session, app, 当前笔记本, 文件名):
    from crystalith.shared.db import Chunk, Source
    from crystalith.shared.types import SourceStatus

    source = Source(
        notebook_id=当前笔记本["id"],
        filename=文件名,
        status=SourceStatus.READY,
    )
    db_session.add(source)
    event_loop.run_until_complete(db_session.flush())

    chunk = Chunk(source_id=source.id, chunk_index=0, text=f"{文件名} 的测试内容。")
    db_session.add(chunk)
    event_loop.run_until_complete(db_session.commit())

    event_loop.run_until_complete(
        app.state.vector_store.add(
            notebook_id=当前笔记本["id"],
            source_id=source.id,
            chunk_ids=[chunk.id],
            vectors=[[1.0, 0.0, 0.0]],
        )
    )
    return {"id": source.id, "filename": 文件名, "chunk_id": chunk.id}


@given(parsers.parse('笔记本中有多篇来源'))
def 添加多篇来源(event_loop, db_session, app, 当前笔记本):
    from crystalith.shared.db import Chunk, Source
    from crystalith.shared.types import SourceStatus

    for i in range(3):
        source = Source(
            notebook_id=当前笔记本["id"],
            filename=f"文档{i}.md",
            status=SourceStatus.READY,
        )
        db_session.add(source)
        event_loop.run_until_complete(db_session.flush())

        chunk = Chunk(source_id=source.id, chunk_index=0, text=f"文档{i} 的内容。")
        db_session.add(chunk)
        event_loop.run_until_complete(db_session.commit())

        event_loop.run_until_complete(
            app.state.vector_store.add(
                notebook_id=当前笔记本["id"],
                source_id=source.id,
                chunk_ids=[chunk.id],
                vectors=[[float(i), 1.0, 0.0]],
            )
        )


@given("笔记本中无来源")
def 笔记本无来源():
    """无需操作，新笔记本默认无来源。"""


@given(parsers.parse('会话中有一条用户消息"{内容}"'))
def 添加用户消息(client, event_loop, 当前笔记本, 当前会话, 内容):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/messages",
            json={"role": "user", "content": 内容},
        )
    )
    assert 响应.status_code == 201, f"创建消息失败: {响应.text}"


@given("笔记本中有一个待处理任务", target_fixture="任务")
def 创建待处理任务(event_loop, db_session, 当前笔记本):
    from crystalith.shared.db import Task
    from crystalith.shared.types import TaskStatus, TaskType

    task = Task(
        notebook_id=当前笔记本["id"],
        type=TaskType.REFINE,
        status=TaskStatus.PENDING,
        payload={"format": "summary"},
    )
    db_session.add(task)
    event_loop.run_until_complete(db_session.commit())
    event_loop.run_until_complete(db_session.refresh(task))
    return {"id": task.id}


# ══════════════════════════════════════════════════════════════════════════════
# When — 操作
# ══════════════════════════════════════════════════════════════════════════════


@when(parsers.parse('创建一个名为"{名称}"的笔记本'))
def 创建笔记本操作(client, event_loop, 响应上下文, 名称):
    响应 = event_loop.run_until_complete(
        client.post("/v1/notebooks", json={"name": 名称})
    )
    响应上下文["响应"] = 响应


@when("请求笔记本列表")
def 请求笔记本列表操作(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/notebooks"))
    响应上下文["响应"] = 响应


@when(parsers.parse('请求笔记本"{名称}"的详情'))
def 请求笔记本详情操作(client, event_loop, 响应上下文, 当前笔记本, 名称):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}")
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('将笔记本重命名为"{新名称}"'))
def 重命名笔记本操作(client, event_loop, 响应上下文, 当前笔记本, 新名称):
    响应 = event_loop.run_until_complete(
        client.patch(f"/v1/notebooks/{当前笔记本['id']}", json={"name": 新名称})
    )
    响应上下文["响应"] = 响应


@when("删除该笔记本")
def 删除笔记本操作(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.delete(f"/v1/notebooks/{当前笔记本['id']}")
    )
    响应上下文["响应"] = 响应


@when("请求不存在的笔记本详情")
def 请求不存在的笔记本操作(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/notebooks/99999"))
    响应上下文["响应"] = 响应


@when(parsers.parse('发送 GET 请求"{路径}"'))
def 发送get请求(client, event_loop, 响应上下文, 路径, request):
    resolved = _resolve_path(路径, request)
    响应 = event_loop.run_until_complete(client.get(resolved))
    响应上下文["响应"] = 响应


@when(parsers.parse('发送 POST 请求"{路径}"，内容为：'))
def 发送post请求(client, event_loop, 响应上下文, 路径, request, doc_string="{}"):
    resolved = _resolve_path(路径, request)
    响应 = event_loop.run_until_complete(
        client.post(resolved, json=_json.loads(doc_string))
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('发送 PATCH 请求"{路径}"，内容为：'))
def 发送patch请求(client, event_loop, 响应上下文, 路径, request, doc_string="{}"):
    resolved = _resolve_path(路径, request)
    响应 = event_loop.run_until_complete(
        client.patch(resolved, json=_json.loads(doc_string))
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('发送 DELETE 请求"{路径}"'))
def 发送delete请求(client, event_loop, 响应上下文, 路径, request):
    resolved = _resolve_path(路径, request)
    响应 = event_loop.run_until_complete(client.delete(resolved))
    响应上下文["响应"] = 响应


# ── 会话管理 ─────────────────────────────────────────────────────────────────


@when(parsers.parse('创建一个名为"{标题}"的会话'))
def 创建会话操作(client, event_loop, 响应上下文, 当前笔记本, 标题):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions",
            json={"title": 标题},
        )
    )
    响应上下文["响应"] = 响应


@when("请求当前笔记本的会话列表")
def 请求会话列表(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/sessions")
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('将会话标题更新为"{新标题}"'))
def 更新会话标题(client, event_loop, 响应上下文, 当前笔记本, 当前会话, 新标题):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}",
            json={"title": 新标题},
        )
    )
    响应上下文["响应"] = 响应


@when("删除当前会话")
def 删除会话操作(client, event_loop, 响应上下文, 当前笔记本, 当前会话):
    响应 = event_loop.run_until_complete(
        client.delete(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}"
        )
    )
    响应上下文["响应"] = 响应


@when("从另一个笔记本访问该会话")
def 跨笔记本访问会话(client, event_loop, 响应上下文, 当前笔记本, 当前会话):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}"
        )
    )
    响应上下文["响应"] = 响应


# ── 消息管理 ─────────────────────────────────────────────────────────────────


@when(parsers.parse('发送一条用户消息"{内容}"'))
def 发送用户消息(client, event_loop, 响应上下文, 当前笔记本, 当前会话, 内容):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/messages",
            json={"role": "user", "content": 内容},
        )
    )
    响应上下文["响应"] = 响应


@when("请求当前会话的消息列表")
def 请求消息列表(client, event_loop, 响应上下文, 当前笔记本, 当前会话):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/messages"
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse("使用分页参数limit={限制:d}请求消息列表"))
def 请求消息列表分页(client, event_loop, 响应上下文, 当前笔记本, 当前会话, 限制):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/messages",
            params={"limit": 限制},
        )
    )
    响应上下文["响应"] = 响应


# ── 来源管理 ─────────────────────────────────────────────────────────────────


@when("请求当前笔记本的来源列表")
def 请求来源列表(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/sources")
    )
    响应上下文["响应"] = 响应


@when("删除当前来源")
def 删除当前来源(client, event_loop, 响应上下文, 当前笔记本, 当前来源):
    响应 = event_loop.run_until_complete(
        client.delete(
            f"/v1/notebooks/{当前笔记本['id']}/sources/{当前来源['id']}"
        )
    )
    响应上下文["响应"] = 响应


@when("批量删除当前笔记本的所有来源")
def 批量删除来源(client, event_loop, 响应上下文, 当前笔记本, db_session):
    from crystalith.shared.db import Source

    sources = event_loop.run_until_complete(
        db_session.execute(
            __import__("sqlalchemy").select(Source.id).where(
                Source.notebook_id == 当前笔记本["id"]
            )
        )
    )
    source_ids = [row[0] for row in sources.all()]
    响应 = event_loop.run_until_complete(
        client.request(
            "DELETE",
            f"/v1/notebooks/{当前笔记本['id']}/sources/batch",
            json={"source_ids": source_ids},
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('再次上传同名文件"{文件名}"并选择提示策略'))
def 再次上传同名文件(client, event_loop, 响应上下文, 当前笔记本, 文件名):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sources",
            params={"dedup_action": "prompt"},
            files={"file": (文件名, b"test content", "text/markdown")},
        )
    )
    响应上下文["响应"] = 响应


# ── 内容精炼 ─────────────────────────────────────────────────────────────────


@when(parsers.parse('使用来源精炼内容为"{格式}"格式'))
def 精炼内容(client, event_loop, 响应上下文, 当前笔记本, 当前来源, 格式):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/refine",
            json={
                "prompt": "请精炼内容",
                "format": 格式,
                "source_ids": [当前来源["id"]],
            },
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('批量精炼内容为 "{格式列表}" 格式'))
def 批量精炼内容(client, event_loop, 响应上下文, 当前笔记本, 当前来源, 格式列表):
    formats = [f.strip() for f in 格式列表.split(",")]
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/refine/batch",
            json={
                "prompt": "请精炼内容",
                "formats": formats,
                "source_ids": [当前来源["id"]],
            },
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('无来源精炼内容为"{格式}"格式'))
def 无来源精炼(client, event_loop, 响应上下文, 当前笔记本, 格式):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/refine",
            json={"prompt": "请精炼内容", "format": 格式},
        )
    )
    响应上下文["响应"] = 响应


# ── 提示词预设 ───────────────────────────────────────────────────────────────


@when("请求提示词预设列表")
def 请求预设列表(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/prompt-presets"))
    响应上下文["响应"] = 响应


@when(parsers.parse('创建提示词预设，触发词为"{触发词}"，提示为"{提示}"'))
def 创建预设(client, event_loop, 响应上下文, 触发词, 提示):
    响应 = event_loop.run_until_complete(
        client.post(
            "/v1/prompt-presets",
            json={"trigger": 触发词, "system_prompt": 提示},
        )
    )
    响应上下文["响应"] = 响应


@given(parsers.parse('已创建预设"{触发词}"'), target_fixture="当前预设")
def 已创建预设(client, event_loop, 触发词):
    响应 = event_loop.run_until_complete(
        client.post(
            "/v1/prompt-presets",
            json={"trigger": 触发词, "system_prompt": f"{触发词} 的系统提示"},
        )
    )
    assert 响应.status_code == 201, f"创建预设失败: {响应.text}"
    return 响应.json()


@when(parsers.parse('更新预设"{触发词}"的描述为"{描述}"'))
def 更新预设(client, event_loop, 响应上下文, 当前预设, 触发词, 描述):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/prompt-presets/{当前预设['preset_id']}",
            json={"description": 描述},
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('删除预设"{触发词}"'))
def 删除预设(client, event_loop, 响应上下文, 当前预设, 触发词):
    响应 = event_loop.run_until_complete(
        client.delete(f"/v1/prompt-presets/{当前预设['preset_id']}")
    )
    响应上下文["响应"] = 响应


# ── 模型管理 ─────────────────────────────────────────────────────────────────


@when("请求模型列表")
def 请求模型列表(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/models"))
    响应上下文["响应"] = 响应


@when(parsers.parse('按角色"{角色}"筛选模型'))
def 按角色筛选模型(client, event_loop, 响应上下文, 角色):
    响应 = event_loop.run_until_complete(
        client.get("/v1/models", params={"role": 角色})
    )
    响应上下文["响应"] = 响应


@given("已知一个模型标识", target_fixture="当前模型标识")
def 获取模型标识(client, event_loop):
    响应 = event_loop.run_until_complete(client.get("/v1/models"))
    assert 响应.status_code == 200, f"获取模型列表失败: {响应.text}"
    models = 响应.json()["models"]
    assert len(models) > 0, "模型列表为空"
    return models[0]["id"]


@when("请求该模型详情")
def 请求模型详情(client, event_loop, 响应上下文, 当前模型标识):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/models/{当前模型标识}")
    )
    响应上下文["响应"] = 响应
    响应上下文["模型标识"] = 当前模型标识


@when(parsers.parse('请求不存在的模型"{模型id}"'))
def 请求不存在的模型(client, event_loop, 响应上下文, 模型id):
    响应 = event_loop.run_until_complete(client.get(f"/v1/models/{模型id}"))
    响应上下文["响应"] = 响应


# ── 命令系统 ─────────────────────────────────────────────────────────────────


@when("请求命令列表")
def 请求命令列表(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/commands"))
    响应上下文["响应"] = 响应


@given(parsers.parse('存在自定义预设"{触发词}"'))
def 创建自定义预设(client, event_loop, 触发词):
    响应 = event_loop.run_until_complete(
        client.post(
            "/v1/prompt-presets",
            json={"trigger": 触发词, "system_prompt": f"{触发词} 测试提示"},
        )
    )
    assert 响应.status_code == 201, f"创建预设失败: {响应.text}"


# ── 模板管理 ─────────────────────────────────────────────────────────────────


@when("请求模板列表")
def 请求模板列表(client, event_loop, 响应上下文):
    响应 = event_loop.run_until_complete(client.get("/v1/templates"))
    响应上下文["响应"] = 响应


@when(parsers.parse('创建一个名为"{名称}"的模板'))
def 创建模板(client, event_loop, 响应上下文, 名称):
    响应 = event_loop.run_until_complete(
        client.post(
            "/v1/templates",
            json={
                "name": 名称,
                "config_json": {
                    "session_titles": ["默认会话"],
                    "output_type": None,
                    "source_tags": [],
                },
            },
        )
    )
    响应上下文["响应"] = 响应


@given(parsers.parse('存在自定义模板"{名称}"'), target_fixture="当前模板")
def 创建自定义模板(client, event_loop, 名称):
    响应 = event_loop.run_until_complete(
        client.post(
            "/v1/templates",
            json={
                "name": 名称,
                "config_json": {
                    "session_titles": ["默认会话"],
                    "output_type": None,
                    "source_tags": [],
                },
            },
        )
    )
    assert 响应.status_code == 201, f"创建模板失败: {响应.text}"
    return 响应.json()


@when("请求该模板详情")
def 请求模板详情(client, event_loop, 响应上下文, 当前模板):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/templates/{当前模板['id']}")
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('将模板重命名为"{新名称}"'))
def 重命名模板(client, event_loop, 响应上下文, 当前模板, 新名称):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/templates/{当前模板['id']}",
            json={"name": 新名称},
        )
    )
    响应上下文["响应"] = 响应


@when("删除该模板")
def 删除模板(client, event_loop, 响应上下文, 当前模板):
    响应 = event_loop.run_until_complete(
        client.delete(f"/v1/templates/{当前模板['id']}")
    )
    响应上下文["响应"] = 响应


@given("存在内置模板", target_fixture="当前模板")
def 确保内置模板(client, event_loop):
    响应 = event_loop.run_until_complete(client.get("/v1/templates"))
    assert 响应.status_code == 200
    templates = 响应.json()
    builtins = [t for t in templates if t.get("is_builtin")]
    assert len(builtins) > 0, "没有内置模板"
    return builtins[0]


@when(parsers.parse('尝试修改内置模板名称为"{新名称}"'))
def 尝试修改内置模板(client, event_loop, 响应上下文, 当前模板, 新名称):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/templates/{当前模板['id']}",
            json={"name": 新名称},
        )
    )
    响应上下文["响应"] = 响应


@when("尝试删除内置模板")
def 尝试删除内置模板(client, event_loop, 响应上下文, 当前模板):
    响应 = event_loop.run_until_complete(
        client.delete(f"/v1/templates/{当前模板['id']}")
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('将笔记本保存为模板"{名称}"'))
def 保存笔记本为模板(client, event_loop, 响应上下文, 当前笔记本, 名称):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/templates",
            json={"name": 名称},
        )
    )
    响应上下文["响应"] = 响应


# ── 来源标签 ─────────────────────────────────────────────────────────────────


@when(parsers.parse('创建一个名为"{名称}"的来源标签'))
def 创建来源标签(client, event_loop, 响应上下文, 当前笔记本, 名称):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags",
            json={"name": 名称},
        )
    )
    响应上下文["响应"] = 响应


@given(parsers.parse('已存在来源标签"{名称}"'), target_fixture="当前标签")
def 已存在来源标签(client, event_loop, 当前笔记本, 名称):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags",
            json={"name": 名称},
        )
    )
    assert 响应.status_code == 201, f"创建标签失败: {响应.text}"
    return 响应.json()


@when("请求当前笔记本的标签列表")
def 请求标签列表(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/sources/tags")
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('将来源标签重命名为"{新名称}"'))
def 重命名来源标签(client, event_loop, 响应上下文, 当前笔记本, 当前标签, 新名称):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags/{当前标签['id']}",
            json={"name": 新名称},
        )
    )
    响应上下文["响应"] = 响应


@when("删除该来源标签")
def 删除来源标签(client, event_loop, 响应上下文, 当前笔记本, 当前标签):
    响应 = event_loop.run_until_complete(
        client.delete(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags/{当前标签['id']}"
        )
    )
    响应上下文["响应"] = 响应


@when("将该标签分配给当前来源")
def 分配标签(client, event_loop, 响应上下文, 当前笔记本, 当前标签, 当前来源):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags/{当前标签['id']}/sources",
            json={"source_ids": [当前来源["id"]]},
        )
    )
    响应上下文["响应"] = 响应


@given("该标签已分配给当前来源")
def 标签已分配(client, event_loop, 当前笔记本, 当前标签, 当前来源):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags/{当前标签['id']}/sources",
            json={"source_ids": [当前来源["id"]]},
        )
    )
    assert 响应.status_code == 200, f"分配标签失败: {响应.text}"


@when("从当前来源移除该标签")
def 移除标签(client, event_loop, 响应上下文, 当前笔记本, 当前标签, 当前来源):
    响应 = event_loop.run_until_complete(
        client.request(
            "DELETE",
            f"/v1/notebooks/{当前笔记本['id']}/sources/tags/{当前标签['id']}/sources",
            json={"source_ids": [当前来源["id"]]},
        )
    )
    响应上下文["响应"] = 响应


# ── 引用管理 ─────────────────────────────────────────────────────────────────


@when("通过分块标识请求引用上下文")
def 通过分块标识请求引用(client, event_loop, 响应上下文, 当前笔记本, 当前来源):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/citations/context",
            params={"chunk_id": 当前来源["chunk_id"]},
        )
    )
    响应上下文["响应"] = 响应


@when("通过来源标识和分块序号请求引用上下文")
def 通过来源和序号请求引用(client, event_loop, 响应上下文, 当前笔记本, 当前来源):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/citations/context",
            params={"source_id": 当前来源["id"], "chunk_index": 1},
        )
    )
    响应上下文["响应"] = 响应


@when("同时提供分块标识和来源标识请求引用上下文")
def 同时提供两种定位器(client, event_loop, 响应上下文, 当前笔记本, 当前来源):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/citations/context",
            params={
                "chunk_id": 当前来源["chunk_id"],
                "source_id": 当前来源["id"],
                "chunk_index": 1,
            },
        )
    )
    响应上下文["响应"] = 响应


@when("不提供定位器请求引用上下文")
def 不提供定位器(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/citations/context"
        )
    )
    响应上下文["响应"] = 响应


# ── 界面状态 ─────────────────────────────────────────────────────────────────


@when("请求界面状态")
def 请求界面状态(client, event_loop, 响应上下文, 当前笔记本, 当前会话):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/ui/state"
        )
    )
    响应上下文["响应"] = 响应
    响应上下文["当前会话"] = 当前会话


@when(parsers.parse('发送界面事件，组件ID为"{组件id}"，事件名为"{事件名}"，基础版本为{版本:d}'))
def 发送界面事件(client, event_loop, 响应上下文, 当前笔记本, 当前会话, 组件id, 事件名, 版本):
    import uuid
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/ui/event",
            json={
                "type": "CUSTOM",
                "name": "ui.v1.event",
                "value": {
                    "componentId": 组件id,
                    "eventName": 事件名,
                    "payload": {},
                    "clientRequestId": str(uuid.uuid4()),
                    "baseRevision": 版本,
                },
            },
        )
    )
    响应上下文["响应"] = 响应
    if 响应.status_code == 200:
        响应上下文["上次状态版本"] = 响应.json()["shared_state_revision"]


@given("已发送一个界面事件")
def 已发送界面事件(client, event_loop, 当前笔记本, 当前会话, 响应上下文):
    import uuid
    request_id = str(uuid.uuid4())
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/ui/event",
            json={
                "type": "CUSTOM",
                "name": "ui.v1.event",
                "value": {
                    "componentId": "test-component",
                    "eventName": "click",
                    "payload": {},
                    "clientRequestId": request_id,
                    "baseRevision": 0,
                },
            },
        )
    )
    assert 响应.status_code == 200, f"发送界面事件失败: {响应.text}"
    响应上下文["上次请求ID"] = request_id
    响应上下文["上次状态版本"] = 响应.json()["shared_state_revision"]


@when("使用相同的请求ID再次发送界面事件")
def 重复发送界面事件(client, event_loop, 响应上下文, 当前笔记本, 当前会话):
    request_id = 响应上下文["上次请求ID"]
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/sessions/{当前会话['id']}/ui/event",
            json={
                "type": "CUSTOM",
                "name": "ui.v1.event",
                "value": {
                    "componentId": "test-component",
                    "eventName": "click",
                    "payload": {},
                    "clientRequestId": request_id,
                    "baseRevision": 0,
                },
            },
        )
    )
    响应上下文["响应"] = 响应


# ── 幻灯片工作室 ─────────────────────────────────────────────────────────────


@when(parsers.parse('创建幻灯片草稿，标题为"{标题}"，提示为"{提示}"'))
def 创建幻灯片草稿(client, event_loop, 响应上下文, 当前笔记本, 当前来源, 标题, 提示):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts",
            json={
                "title": 标题,
                "prompt": 提示,
                "source_ids": [当前来源["id"]],
            },
        )
    )
    响应上下文["响应"] = 响应


@given(parsers.parse('已创建幻灯片草稿"{标题}"'), target_fixture="当前幻灯片")
def 已创建幻灯片草稿(client, event_loop, 当前笔记本, 当前来源, 标题):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts",
            json={
                "title": 标题,
                "prompt": f"{标题} 的提示",
                "source_ids": [当前来源["id"]],
            },
        )
    )
    assert 响应.status_code == 201, f"创建幻灯片草稿失败: {响应.text}"
    return 响应.json()


@when("获取幻灯片草稿详情")
def 获取幻灯片草稿详情(client, event_loop, 响应上下文, 当前笔记本, 当前幻灯片):
    响应 = event_loop.run_until_complete(
        client.get(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts/{当前幻灯片['id']}"
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('更新幻灯片草稿，标题改为"{新标题}"'))
def 更新幻灯片草稿(client, event_loop, 响应上下文, 当前笔记本, 当前幻灯片, 新标题):
    响应 = event_loop.run_until_complete(
        client.patch(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts/{当前幻灯片['id']}",
            json={"title": 新标题},
        )
    )
    响应上下文["响应"] = 响应


@when("更新幻灯片大纲")
def 更新幻灯片大纲(client, event_loop, 响应上下文, 当前笔记本, 当前幻灯片):
    响应 = event_loop.run_until_complete(
        client.put(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts/{当前幻灯片['id']}/outline",
            json={"outline": {"title": "测试大纲", "slides": [{"title": "幻灯片1"}]}},
        )
    )
    响应上下文["响应"] = 响应


@when(parsers.parse('更新幻灯片Markdown为"{markdown}"'))
def 更新幻灯片markdown(client, event_loop, 响应上下文, 当前笔记本, 当前幻灯片, markdown):
    响应 = event_loop.run_until_complete(
        client.put(
            f"/v1/notebooks/{当前笔记本['id']}/slides/drafts/{当前幻灯片['id']}/markdown",
            json={"markdown": markdown},
        )
    )
    响应上下文["响应"] = 响应


# ── 来源连接器 ───────────────────────────────────────────────────────────────


@when("请求可用连接器列表")
def 请求连接器列表(client, event_loop, 响应上下文, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/source-connectors")
    )
    响应上下文["响应"] = 响应


@when("创建一个连接器绑定")
def 创建连接器绑定(client, event_loop, 响应上下文, 当前笔记本):
    import tempfile
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/source-connectors")
    )
    connectors = 响应.json().get("connectors", [])
    if not connectors:
        响应上下文["响应"] = 响应
        return
    connector_id = connectors[0]["connector_id"]
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/source-connectors/{connector_id}/bindings",
            json={"connection_config": {"root_path": tempfile.gettempdir()}},
        )
    )
    响应上下文["响应"] = 响应


@given("已创建连接器绑定", target_fixture="当前连接器绑定")
def 已创建连接器绑定(client, event_loop, 当前笔记本):
    import tempfile
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}/source-connectors")
    )
    connectors = 响应.json().get("connectors", [])
    if not connectors:
        pytest.skip("没有可用的连接器插件")
    connector_id = connectors[0]["connector_id"]
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/source-connectors/{connector_id}/bindings",
            json={"connection_config": {"root_path": tempfile.gettempdir()}},
        )
    )
    assert 响应.status_code == 201, f"创建连接器绑定失败: {响应.text}"
    return 响应.json()


@when("请求该绑定的快照")
def 请求绑定快照(client, event_loop, 响应上下文, 当前笔记本, 当前连接器绑定):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/source-connector-bindings/{当前连接器绑定['id']}/snapshot"
        )
    )
    响应上下文["响应"] = 响应


@when("请求该绑定的同步检查")
def 请求同步检查(client, event_loop, 响应上下文, 当前笔记本, 当前连接器绑定):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/source-connector-bindings/{当前连接器绑定['id']}/sync-check"
        )
    )
    响应上下文["响应"] = 响应


@when("设置该绑定的导入范围")
def 设置导入范围(client, event_loop, 响应上下文, 当前笔记本, 当前连接器绑定):
    响应 = event_loop.run_until_complete(
        client.post(
            f"/v1/notebooks/{当前笔记本['id']}/source-connector-bindings/{当前连接器绑定['id']}/import-scope",
            json={"include_directories": ["docs"]},
        )
    )
    响应上下文["响应"] = 响应


# ══════════════════════════════════════════════════════════════════════════════
# Then — 断言
# ══════════════════════════════════════════════════════════════════════════════


@then(parsers.parse("响应状态码为{状态码:d}"))
def 检查状态码(响应上下文, 状态码):
    响应 = 响应上下文["响应"]
    assert 响应.status_code == 状态码, (
        f"期望状态码 {状态码}，实际 {响应.status_code}，响应体: {响应.text[:500]}"
    )


@then(parsers.parse('响应中"{字段}"的值为"{期望值}"'))
def 检查响应字段字符串(响应上下文, 字段, 期望值):
    数据 = 响应上下文["响应"].json()
    assert str(数据[字段]) == 期望值, f"字段 {字段}: 期望 {期望值!r}，实际 {数据[字段]!r}"


@then(parsers.parse('响应中"{字段}"的值为{期望值:d}'))
def 检查响应字段整数(响应上下文, 字段, 期望值):
    数据 = 响应上下文["响应"].json()
    assert 数据[字段] == 期望值, f"字段 {字段}: 期望 {期望值}，实际 {数据[字段]}"


@then(parsers.parse('响应中"{字段}"为真'))
def 检查响应字段为真(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    assert 数据[字段] is True, f"字段 {字段}: 期望 True，实际 {数据[字段]}"


@then(parsers.parse('响应中"{字段}"为假'))
def 检查响应字段为假(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    assert 数据[字段] is False, f"字段 {字段}: 期望 False，实际 {数据[字段]}"


@then(parsers.parse('响应错误码为"{错误码}"'))
def 检查错误码(响应上下文, 错误码):
    数据 = 响应上下文["响应"].json()
    actual = 数据.get("error_code") or 数据.get("detail", {}).get("error_code")
    assert actual == 错误码, f"期望错误码 {错误码!r}，实际 {actual!r}，响应: {数据}"


@then(parsers.parse("响应列表包含{数量:d}条记录"))
def 检查列表长度(响应上下文, 数量):
    数据 = 响应上下文["响应"].json()
    if isinstance(数据, list):
        items = 数据
    elif isinstance(数据, dict) and "items" in 数据:
        items = 数据["items"]
    else:
        items = 数据
    assert len(items) == 数量, f"期望 {数量} 条记录，实际 {len(items)} 条"


@then(parsers.parse("响应列表至少包含{数量:d}条记录"))
def 检查列表最小长度(响应上下文, 数量):
    数据 = 响应上下文["响应"].json()
    if isinstance(数据, list):
        items = 数据
    elif isinstance(数据, dict) and "items" in 数据:
        items = 数据["items"]
    else:
        items = 数据
    assert len(items) >= 数量, f"期望至少 {数量} 条记录，实际 {len(items)} 条"


@then(parsers.parse("该笔记本不存在"))
def 验证笔记本不存在(client, event_loop, 当前笔记本):
    响应 = event_loop.run_until_complete(
        client.get(f"/v1/notebooks/{当前笔记本['id']}")
    )
    assert 响应.status_code == 404


@then(parsers.parse('响应中"{字段}"包含"{子串}"'))
def 检查字段包含(响应上下文, 字段, 子串):
    数据 = 响应上下文["响应"].json()
    assert 子串 in str(数据[字段]), f"字段 {字段} 不包含 {子串!r}: {数据[字段]!r}"


@then(parsers.parse('响应中"{字段}"为空列表'))
def 检查字段为空列表(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    assert 数据[字段] == [], f"字段 {字段}: 期望空列表，实际 {数据[字段]!r}"


@then(parsers.parse('响应中包含"{字段}"字段'))
def 检查包含字段(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    assert 字段 in 数据, f"响应中缺少字段 {字段!r}，实际字段: {list(数据.keys())}"


@then(parsers.parse('响应中"{字段}"为列表'))
def 检查字段为列表(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    assert isinstance(数据[字段], list), f"字段 {字段}: 期望列表，实际 {type(数据[字段]).__name__}"


@then(parsers.parse('所有模型均包含角色"{角色}"'))
def 检查所有模型包含角色(响应上下文, 角色):
    数据 = 响应上下文["响应"].json()
    for model in 数据["models"]:
        assert 角色 in model["roles"], (
            f"模型 {model['id']} 缺少角色 {角色!r}，实际角色: {model['roles']}"
        )


@then("响应中\"id\"的值为该模型标识")
def 检查模型id(响应上下文):
    数据 = 响应上下文["响应"].json()
    期望 = 响应上下文["模型标识"]
    assert 数据["id"] == 期望, f"模型 id: 期望 {期望!r}，实际 {数据['id']!r}"


@then(parsers.parse('响应中存在来源为"{来源}"的命令'))
def 检查命令来源(响应上下文, 来源):
    数据 = 响应上下文["响应"].json()
    sources = {c.get("source") for c in 数据}
    assert any(cmd.get("source") == 来源 for cmd in 数据), (
        f"没有来源为 {来源!r} 的命令，实际来源: {sources}"
    )


@then(parsers.parse('响应中存在触发词为"{触发词}"的命令'))
def 检查命令触发词(响应上下文, 触发词):
    数据 = 响应上下文["响应"].json()
    assert any(cmd.get("trigger") == 触发词 for cmd in 数据), (
        f"没有触发词为 {触发词!r} 的命令，实际触发词: {[c.get('trigger') for c in 数据]}"
    )


@then(parsers.parse('响应列表按"{字段}"升序排列'))
def 检查列表升序(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    values = [item[字段] for item in 数据]
    assert values == sorted(values), f"列表未按 {字段} 升序排列: {values}"


@then("响应中存在内置模板")
def 检查存在内置模板(响应上下文):
    数据 = 响应上下文["响应"].json()
    assert any(t.get("is_builtin") for t in 数据), (
        f"没有内置模板，模板列表: {[t.get('name') for t in 数据]}"
    )


@then(parsers.parse('响应中"{字段}"的值为当前会话ID'))
def 检查会话id(响应上下文, 字段):
    数据 = 响应上下文["响应"].json()
    会话 = 响应上下文.get("当前会话")
    assert 会话 is not None, "响应上下文中没有当前会话"
    assert 数据[字段] == 会话["id"], (
        f"{字段}: 期望 {会话['id']}，实际 {数据[字段]}"
    )


@then("响应中\"shared_state_revision\"的值为0")
def 检查状态版本为零(响应上下文):
    数据 = 响应上下文["响应"].json()
    assert 数据["shared_state_revision"] == 0, (
        f"shared_state_revision: 期望 0，实际 {数据['shared_state_revision']}"
    )


@then("响应中\"shared_state_revision\"未改变")
def 检查状态版本未改变(响应上下文):
    数据 = 响应上下文["响应"].json()
    上次版本 = 响应上下文.get("上次状态版本")
    assert 上次版本 is not None, "响应上下文中没有上次状态版本"
    assert 数据["shared_state_revision"] == 上次版本, (
        f"shared_state_revision: 期望 {上次版本}（未改变），实际 {数据['shared_state_revision']}"
    )
