import sys
from enum import Enum

if sys.version_info >= (3, 11):
    from enum import ReprEnum, StrEnum  # pragma: no cover
else:
    # copied from https://github.com/python/cpython/blob/1ae900424b3c888d2b2cc97e6ef780717813d658/Lib/enum.py#L1365
    class ReprEnum(Enum):
        """
        Only changes the repr(), leaving str() and format() to the mixed-in type.
        """

    class StrEnum(str, ReprEnum):
        """
        Enum where members are also (and must be) strings
        """

        def __new__(cls, *values: str) -> "StrEnum":
            "values must already be of type `str`"
            if len(values) > 3:
                raise TypeError(f"too many arguments for str(): {values!r}")
            if len(values) == 1:
                # it must be a string
                if not isinstance(values[0], str):
                    raise TypeError(f"{values[0]!r} is not a string")
            if len(values) >= 2:
                # check that encoding argument is a string
                if not isinstance(values[1], str):
                    raise TypeError(f"encoding must be a string, not {values[1]!r}")
            if len(values) == 3:
                # check that errors argument is a string
                if not isinstance(values[2], str):
                    raise TypeError(f"errors must be a string, not {values[2]!r}")
            value = str(*values)
            member = str.__new__(cls, value)
            member._value_ = value
            return member

        @staticmethod
        def _generate_next_value_(name: str, _start: int, _count: int, _last_values: list[str]) -> str:  # pyright: ignore[reportIncompatibleMethodOverride, reportImplicitOverride]
            """
            Return the lower-cased version of the member name.
            """
            return name.lower()
