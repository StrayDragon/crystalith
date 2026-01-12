import itertools
from collections.abc import AsyncIterable, AsyncIterator, Callable, Iterable, Iterator, Sequence
from typing import Protocol, TypeVar

T = TypeVar("T")
V = TypeVar("V")


def filtered_in_sql_values(
    values: Iterable[V] | None,
    target_type_as: Callable[[V], T] = lambda x: x,
) -> list[T]:
    if not values:
        return []

    items: list[T] = []
    seen = set[T]()

    for item in values:
        if item is None or item == "":
            continue
        try:
            converted_value = target_type_as(item)
            if converted_value not in seen:
                seen.add(converted_value)
                items.append(converted_value)
        except (ValueError, TypeError):
            continue

    return items


class IterPageFetchFunc(Protocol[T]):
    async def __call__(self, *, offset: int, limit: int) -> list[T]: ...


async def iter_page(
    fetch_func: IterPageFetchFunc[T],
    offset: int = 0,
    limit: int = 100,
    n_max_iters_or_none_limit: int | None = None,
) -> AsyncIterator[list[T]]:
    """
    异步生成器, 分页请求数据并逐页 yield.

    这个函数会不断调用用户提供的异步函数, 每次递增 offset,
    逐页 yield 返回的数据, 直到没有更多数据或达到最大迭代次数限制.

    Args:
        fetch_func: 异步函数, 接受 offset 和 limit 关键字参数, 返回数据列表
        offset: 起始偏移量, 默认为 0
        limit: 每页大小, 默认为 100
        n_max_iters_or_none_limit: 最大迭代次数, None 表示无限制, 默认为 None

    Yields:
        每一页的数据列表

    Examples:
        async def fetch_users(*, offset: int, limit: int) -> list[User]:
            # 实现分页查询逻辑
            pass

        # 逐页处理用户数据
        async for page in iter_page(fetch_users, limit=50):
            process_page(page)
    """
    current_offset = offset
    n_max_iters = int(n_max_iters_or_none_limit) if n_max_iters_or_none_limit is not None else None

    while True:
        if n_max_iters is not None:
            if n_max_iters <= 0:
                break
            n_max_iters -= 1

        paged_items = await fetch_func(offset=current_offset, limit=limit)

        if not paged_items:
            break

        yield paged_items

        if len(paged_items) < limit:
            break

        current_offset += limit


def chunks(itr: Iterable[T], batch_size: int = 500) -> Iterator[list[T]]:
    """将一个可迭代对象分割成指定大小的多个块 (chunks).

    这个函数是一个生成器,它会懒加载地从输入的可迭代对象中
    读取数据,并每次生成一个列表形式的数据块.这种实现方式对于
    处理大型数据集非常高效,因为它不会一次性将所有数据加载到内存中.

    Examples:
        >>> my_list = list(range(10))
        >>> for chunk in chunks(my_list, 4):
        ...     print(chunk)
        [0, 1, 2, 3]
        [4, 5, 6, 7]
        [8, 9]

    """
    if not isinstance(batch_size, int) or batch_size <= 0:
        raise ValueError("batch_size 必须是一个正整数")

    # 将可迭代对象转换为迭代器,以确保我们可以在其上持续调用 next()
    it = iter(itr)
    while True:
        # 使用 islice 高效地获取下一个块,避免创建中间列表
        chunk = list(itertools.islice(it, batch_size))
        if not chunk:
            # 当 islice 返回一个空列表时,表示原始迭代器已耗尽
            return
        yield chunk


async def async_chunks(
    aitr: AsyncIterable[T],
    batch_size: int = 500,
) -> AsyncIterator[list[T]]:
    """将一个异步可迭代对象分割成指定大小的多个块 (chunks).

    这个函数是一个异步生成器,它会从输入的异步可迭代对象中
    异步地读取数据,并每次生成一个列表形式的数据块.这对于处理
    异步数据流(例如,从数据库或网络 API 获取的数据)非常有用.

    Examples:
        ```python
        import asyncio


        async def async_generator():
            for i in range(10):
                yield i
                await asyncio.sleep(0.01)


        async def main():
            async for chunk in async_chunks(async_generator(), 4):
                print(chunk)


        # 运行 `asyncio.run(main())` 将会输出:
        # [0, 1, 2, 3]
        # [4, 5, 6, 7]
        # [8, 9]
        ```
    """
    if not isinstance(batch_size, int) or batch_size <= 0:
        raise ValueError("batch_size 必须是一个正整数")

    batch: list[T] = []
    ait = aiter(aitr)
    async for item in ait:
        batch.append(item)
        if len(batch) >= batch_size:
            yield batch
            batch = []

    if batch:
        yield batch


ItemT = TypeVar("ItemT")

OffsetPaginationResult = tuple[Sequence[ItemT], int | None]


def get_paged_items_and_cursor(
    query_results: Sequence[ItemT],
    offset: int,
    size: int,
) -> OffsetPaginationResult[ItemT]:
    """
    基于查询结果处理分页逻辑的辅助函数

    用户需要自己调用查询函数,传入 size + 1 作为 limit,然后将结果传给这个函数处理

    Args:
        query_results: 查询结果,应该是用 size + 1 查询得到的
        offset: 当前页的偏移量
        size: 用户请求的页面大小

    Returns:
        tuple[list[ItemT], int | None]: (数据列表, 下一页offset或None)

    Example:
        ```python
        # 用户自己控制查询调用
        raw_results = await my_dal.page_users(
            limit=size + 1,  # 关键:使用 size + 1
            offset=offset,
            status="active",
            keyword="张",
        )

        # 处理分页逻辑
        items, next_offset = get_paged_items_and_cursor(raw_results, offset, size)

        return {"items": items, "next_offset": next_offset, "has_next": next_offset is not None}
        ```
    """
    if len(query_results) <= size:
        # 没有下一页,返回所有结果
        return query_results, None
    # 有下一页,截取前size个元素
    return query_results[:size], offset + size
