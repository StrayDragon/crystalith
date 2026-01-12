"""时间工具函数合集.

原位于 ``lush-timex`` 包, 现并入 ``lush-stdx`` 便于统一维护.
"""

from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo

__all__ = [
    "TZ_SHANGHAI",
    "datetime_to_str",
    "datetime_to_timestamp",
    "str_to_datetime",
    "timestamp_to_datetime",
]


def datetime_to_timestamp(dt: datetime.datetime) -> int:
    """将 ``datetime`` 对象转换为毫秒级时间戳."""

    return int(dt.timestamp() * 1000)


def datetime_to_str(dt: datetime.datetime) -> str:
    """格式化 ``datetime`` 为 ``YYYY-MM-DD HH:MM:SS`` 字符串."""

    return dt.strftime("%Y-%m-%d %H:%M:%S")


def str_to_datetime(d: datetime.datetime | datetime.date | str | None) -> datetime.datetime | None:
    """将字符串/日期转换为 ``datetime``."""

    if not d:
        return None
    if isinstance(d, datetime.datetime):
        return d
    if isinstance(d, datetime.date):
        return datetime.datetime(d.year, d.month, d.day)
    try:
        return datetime.datetime.strptime(d, "%Y-%m-%d %H:%M:%S")  # noqa: DTZ007
    except ValueError:
        try:
            return datetime.datetime.strptime(d, "%Y-%m-%d %H:%M:%S.%f")  # noqa: DTZ007
        except ValueError:
            try:
                return datetime.datetime.strptime(d, "%Y-%m-%d")  # noqa: DTZ007
            except ValueError:
                return datetime.datetime.strptime(d, "%Y-%m-%d %H:%M")  # noqa: DTZ007


TZ_SHANGHAI = ZoneInfo("Asia/Shanghai")
"""默认时区: 上海."""


def timestamp_to_datetime(
    ts_seconds: float,
    tzinfo: ZoneInfo | None = TZ_SHANGHAI,
) -> datetime.datetime:
    """将秒级时间戳转换为指定时区的 ``datetime``."""

    return datetime.datetime.fromtimestamp(ts_seconds, tzinfo)
