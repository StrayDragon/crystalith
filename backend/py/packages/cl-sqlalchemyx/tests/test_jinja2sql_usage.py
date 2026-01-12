import asyncio
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

import pytest
from jinja2sql import Jinja2SQL


def _values(obj: object) -> list[Any]:
    v = getattr(obj, "values", None)
    if callable(v):
        return list(cast(Any, v)())
    return list(cast(Iterable[Any], obj))


def test_from_string_named_param() -> None:
    j2sql = Jinja2SQL()

    query, params = j2sql.from_string(
        "SELECT * FROM {{ table | identifier }} WHERE email = {{ email }}",
        context={"table": "users", "email": "user@mail.com"},
        param_style="named",
    )

    assert query in (
        "SELECT * FROM users WHERE email = :email",
        "SELECT * FROM users WHERE email = :email__1",
    )
    # 返回的参数名可能会去重并添加后缀, 两种情况都接受
    assert params in (
        {"email": "user@mail.com"},
        {"email__1": "user@mail.com"},
    )


@pytest.mark.asyncio
async def test_from_string_async_named_param() -> None:
    j2sql = Jinja2SQL(enable_async=True)

    query, params = await j2sql.from_string_async(
        "SELECT * FROM {{ table | identifier }} WHERE email = {{ email }}",
        context={"table": "users", "email": "user@mail.com"},
        param_style="named",
    )

    assert query in (
        "SELECT * FROM users WHERE email = :email",
        "SELECT * FROM users WHERE email = :email__1",
    )
    assert params in (
        {"email": "user@mail.com"},
        {"email__1": "user@mail.com"},
    )


def test_from_string_param_styles_pyformat() -> None:
    j2sql = Jinja2SQL()

    query, params = j2sql.from_string(
        "SELECT * FROM table WHERE param = {{ param }}",
        context={"param": 123},
        param_style="pyformat",
    )

    assert query in (
        "SELECT * FROM table WHERE param = %(param)s",
        "SELECT * FROM table WHERE param = %(param__1)s",
    )
    assert params in (
        {"param": 123},
        {"param__1": 123},
    )


def test_custom_filter_array_literal() -> None:
    j2sql = Jinja2SQL()

    def array_filter(self: Jinja2SQL, value: list[str]) -> str:
        return self.identifier(", ".join(f"'{item}'" for item in value))

    j2sql.register_filter("array2", array_filter)

    query, params = j2sql.from_string(
        "SELECT ARRAY[{{ param | array2 }}] AS array",
        context={"param": ["0", "1"]},
    )

    assert query == "SELECT ARRAY['0', '1'] AS array"
    assert params == {}


def test_from_file_named(tmp_path: Path) -> None:
    query_file = tmp_path / "query.sql"
    _ = query_file.write_text(
        "SELECT * FROM {{ table | identifier }} WHERE id = {{ id }}",
        encoding="utf-8",
    )

    j2sql = Jinja2SQL(searchpath=tmp_path)
    query, params = j2sql.from_file(
        "query.sql",
        context={"table": "users", "id": 7},
        param_style="named",
    )

    assert query in (
        "SELECT * FROM users WHERE id = :id",
        "SELECT * FROM users WHERE id = :id__1",
    )
    assert params in ({"id": 7}, {"id__1": 7})


@pytest.mark.asyncio
async def test_from_file_async_named(tmp_path: Path) -> None:
    query_file = tmp_path / "q.sql"
    _ = query_file.write_text(
        "SELECT * FROM {{ table | identifier }} WHERE id = {{ id }}",
        encoding="utf-8",
    )

    j2sql = Jinja2SQL(searchpath=tmp_path, enable_async=True)
    query, params = await j2sql.from_file_async(
        "q.sql",
        context={"table": "users", "id": 9},
        param_style="named",
    )

    assert query in (
        "SELECT * FROM users WHERE id = :id",
        "SELECT * FROM users WHERE id = :id__1",
    )
    assert params in ({"id": 9}, {"id__1": 9})


def test_param_styles_variants() -> None:
    j2sql = Jinja2SQL()

    # qmark
    q1, p1 = j2sql.from_string(
        "SELECT * FROM t WHERE a = {{ a }} AND b = {{ b }}",
        context={"a": 1, "b": 2},
        param_style="qmark",
    )
    assert q1 == "SELECT * FROM t WHERE a = ? AND b = ?"
    v1 = _values(p1)
    assert v1 == [1, 2]

    # numeric
    q2, p2 = j2sql.from_string(
        "SELECT * FROM t WHERE a = {{ a }} AND b = {{ b }}",
        context={"a": 1, "b": 2},
        param_style="numeric",
    )
    assert q2 == "SELECT * FROM t WHERE a = :1 AND b = :2"
    v2 = _values(p2)
    assert v2 == [1, 2]

    # format
    q3, p3 = j2sql.from_string(
        "SELECT * FROM t WHERE a = {{ a }} AND b = {{ b }}",
        context={"a": 1, "b": 2},
        param_style="format",
    )
    assert q3 == "SELECT * FROM t WHERE a = %s AND b = %s"
    v3 = _values(p3)
    assert v3 == [1, 2]

    # asyncpg
    q4, p4 = j2sql.from_string(
        "SELECT * FROM t WHERE a = {{ a }} AND b = {{ b }}",
        context={"a": 1, "b": 2},
        param_style="asyncpg",
    )
    assert q4 == "SELECT * FROM t WHERE a = $1 AND b = $2"
    v4 = _values(p4)
    assert v4 == [1, 2]


def test_custom_param_style_callable() -> None:
    j2sql = Jinja2SQL()

    query, params = j2sql.from_string(
        "SELECT * FROM t WHERE email = {{ email }}",
        context={"email": "a@b.com"},
        param_style=lambda param_key, param_index: f"{{{param_key}}}",
    )
    assert query in (
        "SELECT * FROM t WHERE email = {email}",
        "SELECT * FROM t WHERE email = {email__1}",
    )
    assert params in (
        {"email": "a@b.com"},
        {"email__1": "a@b.com"},
    )


def test_conditionals_in_template() -> None:
    j2sql = Jinja2SQL()
    tmpl = "SELECT 1{% if use_where %} WHERE status = {{ status }}{% endif %}"

    # without where
    q1, p1 = j2sql.from_string(tmpl, context={"use_where": False, "status": 1}, param_style="named")
    assert q1.strip() == "SELECT 1"
    assert p1 in ({},)

    # with where
    q2, p2 = j2sql.from_string(tmpl, context={"use_where": True, "status": 2}, param_style="named")
    assert q2 in ("SELECT 1 WHERE status = :status", "SELECT 1 WHERE status = :status__1")
    assert p2 in ({"status": 2}, {"status__1": 2})


def test_register_filter_method() -> None:
    j2sql = Jinja2SQL()

    def csv(self: Jinja2SQL, value: list[str]) -> str:
        return ", ".join(self.identifier(f"'{v}'") for v in value)

    j2sql.register_filter("csv", csv)
    q, p = j2sql.from_string(
        "SELECT {{ vals | csv }}",
        context={"vals": ["a", "b"]},
    )
    if q == "SELECT 'a', 'b'":
        assert p == {}
    else:
        assert q.startswith("SELECT :")
        vals = _values(p)
        assert len(vals) == 1
        s = str(vals[0]) if vals else ""
        assert "a" in s
        assert "b" in s


def test_async_without_enable_async_raises() -> None:
    j2sql = Jinja2SQL()
    with pytest.raises(Exception):  # library should require enable_async for async API
        # Intentionally not awaited to trigger path resolution, but execute in loop
        _ = asyncio.get_event_loop().run_until_complete(j2sql.from_string_async("SELECT 1", context={}))
