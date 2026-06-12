"""BDD 步骤定义的共享 fixtures。

公共步骤通过 tests/bdd/conftest.py 中的 pytest_plugins 加载。
"""
from __future__ import annotations

import json

import pytest


@pytest.fixture
def sse事件列表():
    """存储 SSE 流式响应中收集到的事件。"""
    return []


@pytest.fixture
def 解析sse响应(event_loop, client, sse事件列表):
    """解析 SSE 响应流，返回事件收集器。"""

    def _解析(响应):
        async def _do_parse():
            async with 响应 as stream:
                current_event = {}
                async for line in stream.aiter_lines():
                    line = line.strip()
                    if line.startswith("event:"):
                        current_event["event"] = line[len("event:"):].strip()
                    elif line.startswith("data:"):
                        data_str = line[len("data:"):].strip()
                        try:
                            current_event["data"] = json.loads(data_str)
                        except Exception:
                            current_event["data"] = data_str
                    elif line == "" and current_event:
                        sse事件列表.append(current_event)
                        current_event = {}
                if current_event:
                    sse事件列表.append(current_event)
            return sse事件列表

        return event_loop.run_until_complete(_do_parse())

    return _解析
