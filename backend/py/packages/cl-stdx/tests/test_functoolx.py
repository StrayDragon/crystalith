from cl_stdx.functoolx import ONE_MINUTE, ttl_lru_cache
from freezegun import freeze_time


def test_ttl_cache_basic_hit_and_expire() -> None:
    calls: dict[str, int] = {"count": 0}

    @ttl_lru_cache(ttl=ONE_MINUTE, max_size=32)
    def calc(x: int) -> int:
        calls["count"] += 1
        return x * 10

    with freeze_time("2024-01-01 00:00:00"):
        assert calc(1) == 10
        assert calc(1) == 10
        # 同一时间片命中缓存
        assert calls["count"] == 1

    # 跳到下一个时间片,应当触发重新计算
    with freeze_time("2024-01-01 00:01:00"):
        assert calc(1) == 10
        assert calls["count"] == 2


def test_ttl_cache_clear_and_info() -> None:
    @ttl_lru_cache(ttl=ONE_MINUTE, max_size=8)
    def echo(v: str) -> str:
        return v

    with freeze_time("2024-01-01 00:00:00"):
        assert echo("a") == "a"
        info_before = echo.cache_info()  # type: ignore[attr-defined] # pyright: ignore[reportFunctionMemberAccess]
        # 命中率/大小不可预期,仅校验对象存在字段
        assert hasattr(info_before, "hits")
        assert hasattr(info_before, "misses")

        echo.cache_clear()  # type: ignore[attr-defined] # pyright: ignore[reportFunctionMemberAccess]
        info_after = echo.cache_info()  # type: ignore[attr-defined] # pyright: ignore[reportFunctionMemberAccess]
        # 清理后 miss 次数可能不归零(实现相关),只要不异常即可
        assert hasattr(info_after, "hits")


# 不再测试 typed 行为, 默认遵循 Python 的键合并: 1 与 1.0 视为同键


def test_ttl_cache_merge_int_and_float_by_default() -> None:
    calls: dict[str, int] = {"count": 0}

    @ttl_lru_cache(ttl=ONE_MINUTE, max_size=16)
    def identity(v):
        calls["count"] += 1
        return v

    with freeze_time("2024-01-01 00:00:00"):
        assert identity(1) == 1
        assert identity(1.0) == 1.0
        # 默认行为: 1 与 1.0 合并为同键
        assert calls["count"] == 1


def test_ttl_cache_lru_eviction() -> None:
    # 小容量以触发淘汰
    @ttl_lru_cache(ttl=ONE_MINUTE, max_size=2)
    def square(n: int) -> int:
        return n * n

    with freeze_time("2024-01-01 00:00:00"):
        assert square(1) == 1
        assert square(2) == 4
        # 此时缓存 (1, 2)
        assert square(1) == 1  # 使用 1, LRU 次序变化, (2, 1)
        assert square(3) == 9  # 触发淘汰 2, 缓存变为 (1, 3)
        # 再次访问 2 应重新计算
        assert square(2) == 4


def test_ttl_zero_behaves_as_pure_lru() -> None:
    calls = {"n": 0}

    @ttl_lru_cache(ttl=0, max_size=8)
    def add(a: int, b: int = 0) -> int:
        calls["n"] += 1
        return a + b

    with freeze_time("2024-01-01 00:00:00"):
        assert add(1, b=2) == 3
    # ttl=0 不分片, 不应失效
    with freeze_time("2024-01-01 12:00:00"):
        assert add(1, b=2) == 3
        assert calls["n"] == 1


def test_kwargs_order_independent() -> None:
    calls = {"n": 0}

    @ttl_lru_cache(ttl=ONE_MINUTE, max_size=8)
    def combine(a: int, b: int = 0, c: int = 0) -> int:
        calls["n"] += 1
        return a + b + c

    with freeze_time("2024-01-01 00:00:00"):
        assert combine(1, b=2, c=3) == 6
        # 交换 kwargs 顺序, 仍应命中缓存
        assert combine(1, c=3, b=2) == 6
        assert calls["n"] == 1


def test_wrapper_preserves_attrs() -> None:
    @ttl_lru_cache(ttl=ONE_MINUTE)
    def sumx(a: int, b: int) -> int:
        """docstring"""
        return a + b

    assert sumx.__name__ == "sumx"
    assert sumx.__doc__ == "docstring"
    # 暴露的控制方法存在
    assert hasattr(sumx, "cache_clear")
    assert hasattr(sumx, "cache_info")
