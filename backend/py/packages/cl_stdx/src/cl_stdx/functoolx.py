import time
from collections.abc import Callable
from functools import lru_cache, wraps
from typing import Any, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")


ONE_SECOND = 1
ONE_MINUTE = 60
ONE_HOUR = 60 * ONE_MINUTE
ONE_DAY = 24 * ONE_HOUR
ONE_WEEK = 7 * ONE_DAY


def ttl_lru_cache(ttl: int, max_size: int = 128) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """带TTL(生存时间)的LRU缓存装饰器.

    将 LRU(最近最少使用) 与 TTL(生存时间) 组合:
    - 限制缓存容量,超限时淘汰最近最少使用的条目
    - 在指定 TTL 时间片变化后,自动视为新的缓存键,从而实现过期

    设计说明:
    - 当 ``ttl <= 0`` 时,退化为纯 LRU 缓存(永不过期)
    - 注意: Python 的 ``functools.lru_cache`` 默认不区分 ``1`` 与 ``1.0`` 的键.
      本实现同样遵循该行为,默认会将 ``1`` 与 ``1.0`` 视为同一键.
      若你需要区分,建议在调用时自行规范参数类型(例如显式转换为 ``str`` 或引入类型标签).

    Args:
        ttl: 生存时间(秒).``ttl<=0`` 表示永不过期
        max_size: LRU 最大容量

    Returns:
        装饰器函数
    """

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        # 为了保证 kwargs 顺序无关,我们将其转换为有序元组(sorted by key)
        @lru_cache(maxsize=max_size, typed=False)
        def cached_func(
            _pos_args: tuple[Any, ...],
            _kw_items: tuple[tuple[str, Any], ...],
            _ttl_slice: int,
        ) -> R:
            return func(*_pos_args, **dict(_kw_items))

        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # 计算时间分片: ttl>0 时按间隔划分,否则固定为 0
            ttl_slice = int(time.time() // ttl) if ttl > 0 else 0
            kw_items = tuple(sorted(kwargs.items()))
            return cached_func(tuple(args), kw_items, ttl_slice)

        def cache_clear() -> None:
            cached_func.cache_clear()

        def cache_info() -> Any:
            return cached_func.cache_info()

        wrapper.cache_clear = cache_clear  # pyright: ignore[reportAttributeAccessIssue]
        wrapper.cache_info = cache_info  # pyright: ignore[reportAttributeAccessIssue]
        return wrapper

    return decorator
