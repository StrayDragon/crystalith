"""语言特性扩展: OptionT 可选值容器."""

from __future__ import annotations

from typing import Generic, TypeVar

from typing_extensions import override

__all__ = ["OptionT"]

T = TypeVar("T")


class OptionT(Generic[T]):
    """高性能可选值包装器 (类似 Rust 的 ``Option[T]``)."""

    __slots__ = ("_value",)

    def __init__(self, value: T | None = None) -> None:
        self._value = value

    def unwrap(self) -> T:
        if self._value is None:
            raise ValueError("OptionT value is None. Check with 'if box:' before calling .unwrap()")
        return self._value

    def unwrap_or(self, default: T) -> T:
        return self._value if self._value is not None else default

    def is_some(self) -> bool:
        return self._value is not None

    def is_none(self) -> bool:
        return self._value is None

    def __bool__(self) -> bool:
        return self._value is not None

    @override
    def __repr__(self) -> str:
        return f"OptionT({self._value!r})" if self._value is not None else "OptionT(None)"

    @override
    def __str__(self) -> str:
        return str(self._value) if self._value is not None else "None"

    @override
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, OptionT):
            return False
        return self._value == other._value  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]

    @override
    def __hash__(self) -> int:
        return hash(self._value)
