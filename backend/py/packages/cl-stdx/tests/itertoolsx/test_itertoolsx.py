import asyncio
from collections.abc import AsyncGenerator, Iterable, Sequence
from typing import Any, cast

import pytest
from cl_stdx.itertoolsx import (
    async_chunks,
    chunks,
    filtered_in_sql_values,
    get_paged_items_and_cursor,
    iter_page,
)


@pytest.mark.parametrize(
    ("_test_id", "values", "target_type", "expected"),
    [
        # Test Case ID, input_values, target_type, expected_output
        pytest.param("basic_int", ["1", "2", "3"], int, [1, 2, 3], id="int_basic"),
        pytest.param("int_with_duplicates", ["1", "2", "1", "3"], int, [1, 2, 3], id="int_with_duplicates"),
        pytest.param("int_with_none_and_empty", ["1", "", None, "2", " "], int, [1, 2], id="int_with_none_and_empty"),
        pytest.param("int_with_invalid_str", ["1", "abc", "2", "!"], int, [1, 2], id="int_with_invalid_strings"),
        pytest.param("int_with_mixed_types", [1, "2", 3.0, 4], int, [1, 2, 3, 4], id="int_with_mixed_types"),
        pytest.param("int_with_zero_and_negatives", ["-10", "0", "10", "0"], int, [-10, 0, 10], id="int_with_zero_and_negatives"),
        pytest.param("all_invalid_for_int", ["a", "b", None], int, [], id="int_all_invalid"),
        pytest.param("basic_str", ["a", "b", "c"], str, ["a", "b", "c"], id="str_basic"),
        pytest.param("str_with_duplicates", ["a", "b", "a"], str, ["a", "b"], id="str_with_duplicates"),
        pytest.param("str_with_none_and_empty", ["a", None, "", "b"], str, ["a", "b"], id="str_with_none_and_empty"),
        # This test is updated to reflect that the new function converts all types to string.
        pytest.param(
            "str_with_mixed_types", [123, "a", 45.6, "b", None], str, ["123", "a", "45.6", "b"], id="str_with_mixed_types_now_converts"
        ),
        pytest.param("str_with_whitespace", [" a ", "b", " a "], str, [" a ", "b"], id="str_with_whitespace"),
        pytest.param("basic_float", ["1.1", "2.2", "3"], float, [1.1, 2.2, 3.0], id="float_basic"),
        pytest.param("float_with_invalid", ["1.1", "abc", "1.1", None, ""], float, [1.1], id="float_with_invalid"),
        pytest.param("empty_list_input", [], int, [], id="empty_list_input"),
        pytest.param("none_input", None, int, [], id="none_input"),
        pytest.param("tuple_input", ("-1", "0", "1", "-1"), int, [-1, 0, 1], id="tuple_input"),
        # Note: set order is not guaranteed, so we sort both lists for comparison
        pytest.param("set_input", {"-5", "5", "", None}, int, [-5, 5], id="set_input"),
    ],
)
def test_filtered_in_sql_values(
    _test_id: str,
    values: Iterable[Any] | None,
    target_type: type[Any],
    expected: Sequence[Any],
) -> None:
    """
    Tests the filtered_in_sql_values function with various inputs and types.
    """
    result: list[Any] = filtered_in_sql_values(values, target_type)

    # Sort both lists before comparing to ensure the test is order-independent,
    # which is robust for inputs like sets.
    assert sorted(result) == sorted(expected)


# Test for iter_page function
@pytest.mark.asyncio
class TestIterPage:
    """测试 iter_page 异步生成器函数"""

    async def test_basic_pagination_with_protocol(self):
        """测试使用协议的基本分页功能"""
        # 创建模拟数据
        mock_data = [
            ["user1", "user2"],  # 第1页
            ["user3", "user4"],  # 第2页
            ["user5"],  # 第3页(不满limit)
        ]
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1

            page_index = offset // limit
            if page_index < len(mock_data):
                return mock_data[page_index]
            empty: list[str] = []
            return empty

        pages = [page async for page in iter_page(mock_fetch_func, offset=0, limit=2)]

        assert pages == [["user1", "user2"], ["user3", "user4"], ["user5"]]
        assert call_count == 3  # 3页数据,最后一页不满limit,停止

    async def test_max_iterations_limit(self):
        """测试最大迭代次数限制"""
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1
            # 始终返回数据,模拟无限数据源
            return [f"item{offset + i}" for i in range(limit)]

        pages = [page async for page in iter_page(mock_fetch_func, offset=0, limit=2, n_max_iters_or_none_limit=3)]

        # 应该只获取3页数据
        assert len(pages) == 3
        assert pages == [["item0", "item1"], ["item2", "item3"], ["item4", "item5"]]
        assert call_count == 3

    async def test_no_max_iterations_limit(self):
        """测试无最大迭代次数限制的情况"""
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1

            if call_count <= 2:
                return [f"item{offset + i}" for i in range(limit)]
            empty: list[str] = []
            return empty  # 第3次调用返回空

        pages = [page async for page in iter_page(mock_fetch_func, offset=0, limit=2, n_max_iters_or_none_limit=None)]

        assert len(pages) == 2  # 只获取2页,因为第3页为空
        assert pages == [["item0", "item1"], ["item2", "item3"]]
        assert call_count == 3  # 2页数据 + 1页空数据

    async def test_empty_response_immediate_stop(self):
        """测试空响应立即停止"""
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1
            _ = (offset, limit)
            empty: list[str] = []
            return empty  # 立即返回空

        pages = [page async for page in iter_page(mock_fetch_func, offset=0, limit=10)]

        assert pages == []
        assert call_count == 1

    async def test_partial_last_page(self):
        """测试最后一页数据不完整的情况"""
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1

            if offset == 0:
                return ["a", "b"]  # 第1页:满页
            if offset == 2:
                return ["c"]  # 第2页:不满页,结束
            _ = limit
            empty: list[str] = []
            return empty

        pages = [page async for page in iter_page(mock_fetch_func, offset=0, limit=2)]

        assert pages == [["a", "b"], ["c"]]
        assert call_count == 2  # 2页数据,最后一页不满limit,停止

    async def test_custom_start_offset(self):
        """测试自定义起始偏移量"""
        call_count = 0

        async def mock_fetch_func(*, offset: int, limit: int) -> list[str]:
            nonlocal call_count
            call_count += 1

            if offset == 5:
                return ["item5", "item6"]  # 从offset=5开始
            if offset == 7:
                return ["item7"]  # 下一页
            _ = limit
            empty: list[str] = []
            return empty

        pages = [page async for page in iter_page(mock_fetch_func, offset=5, limit=2)]

        assert pages == [["item5", "item6"], ["item7"]]
        assert call_count == 2  # 2页数据,最后一页不满limit,停止


# --- 同步函数 `chunks` 的测试 ---


@pytest.mark.parametrize(
    "iterable, batch_size, expected",
    [
        # 测试用例 1: 空的可迭代对象
        ([], 10, []),
        # 测试用例 2: 元素数量小于 batch_size
        ([1, 2, 3], 5, [[1, 2, 3]]),
        # 测试用例 3: 元素数量正好是 batch_size 的整数倍
        (list(range(9)), 3, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]),
        # 测试用例 4: 元素数量不是 batch_size 的整数倍
        (list(range(10)), 4, [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]),
        # 测试用例 5: batch_size 为 1
        ([1, 2, 3], 1, [[1], [2], [3]]),
        # 测试用例 6: 使用生成器作为输入
        (iter(range(5)), 2, [[0, 1], [2, 3], [4]]),
    ],
)
def test_chunks_various_scenarios(
    iterable: Iterable[int],
    batch_size: int,
    expected: Sequence[list[int]],
) -> None:
    """测试 chunks 函数在不同场景下的行为."""
    result = list(chunks(iterable, batch_size))
    assert result == expected


def test_chunks_large_iterable_memory_efficiency():
    """测试 chunks 在处理大型迭代器时的行为,确保它是懒加载的."""
    # 使用生成器以避免在内存中创建大型列表
    large_iterable = (i for i in range(100_000))
    chunk_iterator = chunks(large_iterable, 1000)

    first_chunk = next(chunk_iterator)
    assert len(first_chunk) == 1000
    assert first_chunk[0] == 0
    assert first_chunk[-1] == 999

    # 验证迭代器可以继续
    second_chunk = next(chunk_iterator)
    assert len(second_chunk) == 1000
    assert second_chunk[0] == 1000


def test_chunks_invalid_batch_size():
    """测试当 batch_size 无效时是否会抛出 ValueError."""
    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        _ = next(chunks([1, 2, 3], 0))

    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        _ = next(chunks([1, 2, 3], -1))

    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        # mypy 会提示类型错误,但这里是为了测试运行时检查
        _ = next(chunks([1, 2, 3], cast(Any, 1.5)))


async def async_generator(data: Sequence[int]) -> AsyncGenerator[int, None]:
    for item in data:
        await asyncio.sleep(0.001)  # 模拟 I/O 延迟
        yield item


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "data, batch_size, expected",
    [
        # 测试用例 1: 空的异步可迭代对象
        ([], 10, []),
        # 测试用例 2: 元素数量小于 batch_size
        ([1, 2, 3], 5, [[1, 2, 3]]),
        # 测试用例 3: 元素数量正好是 batch_size 的整数倍
        (list(range(9)), 3, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]),
        # 测试用例 4: 元素数量不是 batch_size 的整数倍
        (list(range(10)), 4, [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]),
        # 测试用例 5: batch_size 为 1
        ([1, 2, 3], 1, [[1], [2], [3]]),
    ],
)
async def test_async_chunks_various_scenarios(
    data: Sequence[int],
    batch_size: int,
    expected: Sequence[list[int]],
) -> None:
    """测试 async_chunks 函数在不同场景下的行为."""
    aitr = async_generator(data)
    result = [chunk async for chunk in async_chunks(aitr, batch_size)]
    assert result == expected


@pytest.mark.asyncio
async def test_async_chunks_large_iterable():
    """测试 async_chunks 在处理大型异步迭代器时的行为."""
    large_aitr = async_generator(list(range(100_000)))
    chunk_iterator = async_chunks(large_aitr, 1000)

    first_chunk = await anext(chunk_iterator)
    assert len(first_chunk) == 1000
    assert first_chunk[0] == 0
    assert first_chunk[-1] == 999

    # 验证迭代器可以继续
    second_chunk = await anext(chunk_iterator)
    assert len(second_chunk) == 1000
    assert second_chunk[0] == 1000


@pytest.mark.asyncio
async def test_async_chunks_invalid_batch_size():
    """测试当 batch_size 无效时 async_chunks 是否会抛出 ValueError."""
    aitr = async_generator([1, 2, 3])
    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        _ = await anext(async_chunks(aitr, 0))

    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        _ = await anext(async_chunks(aitr, -1))

    with pytest.raises(ValueError, match="batch_size 必须是一个正整数"):
        _ = await anext(async_chunks(aitr, cast(Any, 1.5)))


# --- Tests for get_paged_items_and_cursor ---


class TestGetPagedItemsAndCursor:
    """Tests for get_paged_items_and_cursor function."""

    def test_no_next_page_exact_size(self):
        """Test when query results exactly match size - no next page."""
        # Line 205-207: len(query_results) <= size returns (query_results, None)
        query_results = ["a", "b", "c"]  # Exactly 3 items, size is 3
        items, next_offset = get_paged_items_and_cursor(query_results, offset=0, size=3)

        assert items == ["a", "b", "c"]
        assert next_offset is None  # No next page

    def test_no_next_page_less_than_size(self):
        """Test when query results are less than size - no next page."""
        # Line 205-207: len(query_results) <= size returns (query_results, None)
        query_results = ["a", "b"]  # Only 2 items, size is 5
        items, next_offset = get_paged_items_and_cursor(query_results, offset=10, size=5)

        assert items == ["a", "b"]
        assert next_offset is None  # No next page

    def test_has_next_page(self):
        """Test when there is a next page."""
        # Line 208-209: len(query_results) > size returns (query_results[:size], offset + size)
        query_results = ["a", "b", "c", "d", "e", "f"]  # 6 items, size is 3
        items, next_offset = get_paged_items_and_cursor(query_results, offset=0, size=3)

        assert items == ["a", "b", "c"]  # Only first 3
        assert next_offset == 3  # Next offset is 0 + 3

    def test_has_next_page_non_zero_offset(self):
        """Test next page calculation with non-zero offset."""
        query_results = ["a", "b", "c", "d", "e", "f"]  # 6 items
        items, next_offset = get_paged_items_and_cursor(query_results, offset=10, size=3)

        assert items == ["a", "b", "c"]
        assert next_offset == 13  # 10 + 3

    def test_empty_results(self):
        """Test with empty query results."""
        query_results = []
        items, next_offset = get_paged_items_and_cursor(query_results, offset=0, size=10)

        assert items == []
        assert next_offset is None

    def test_exactly_one_more_than_size(self):
        """Test when results are exactly size + 1."""
        query_results = ["a", "b", "c", "d"]  # 4 items, size is 3
        items, next_offset = get_paged_items_and_cursor(query_results, offset=0, size=3)

        assert items == ["a", "b", "c"]
        assert next_offset == 3

    def test_return_type_is_tuple(self):
        """Test that return type is a tuple."""
        query_results = ["a", "b"]
        result = get_paged_items_and_cursor(query_results, offset=0, size=5)

        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_items_preserved_order(self):
        """Test that items order is preserved."""
        query_results = ["z", "y", "x", "w", "v"]
        items, next_offset = get_paged_items_and_cursor(query_results, offset=0, size=3)

        assert items == ["z", "y", "x"]
        assert next_offset == 3
