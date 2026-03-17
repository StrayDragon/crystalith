"""时间工具函数合集.

原位于独立的 timex 包, 现并入 ``cl-stdx`` 便于统一维护.
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

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ_SHANGHAI)
    return int(dt.timestamp() * 1000)


def datetime_to_str(dt: datetime.datetime) -> str:
    """格式化 ``datetime`` 为 ``YYYY-MM-DD HH:MM:SS`` 字符串."""

    return dt.strftime("%Y-%m-%d %H:%M:%S")


def str_to_datetime(d: datetime.datetime | datetime.date | str | None) -> datetime.datetime | None:
    """将字符串/日期转换为 ``datetime``."""

    if not d:
        return None
    if isinstance(d, datetime.datetime):
        if d.tzinfo is None:
            return d.replace(tzinfo=TZ_SHANGHAI)
        return d
    if isinstance(d, datetime.date):
        return datetime.datetime(d.year, d.month, d.day, tzinfo=TZ_SHANGHAI)

    if "T" in d:
        raise ValueError("ISO8601 'T' separator is not supported")

    value = d.strip()
    if not value:
        return None

    date_part: str
    time_part: str | None
    if " " in value:
        date_part, time_part = value.split(" ", 1)
        time_part = time_part.strip() or None
    else:
        date_part, time_part = value, None

    try:
        year_str, month_str, day_str = date_part.split("-", 2)
        year = int(year_str)
        month = int(month_str)
        day = int(day_str)
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError(f"Invalid date: {date_part!r}") from exc

    if time_part is None:
        return datetime.datetime(year, month, day, tzinfo=TZ_SHANGHAI)

    microsecond = 0
    if "." in time_part:
        time_part, frac = time_part.split(".", 1)
        digits = "".join(ch for ch in frac if ch.isdigit())
        if not digits:
            raise ValueError(f"Invalid microseconds: {value!r}")
        microsecond = int((digits + "000000")[:6])

    parts = time_part.split(":")
    if len(parts) == 2:
        hour_str, minute_str = parts
        second_str = "0"
    elif len(parts) == 3:
        hour_str, minute_str, second_str = parts
    else:
        raise ValueError(f"Invalid time: {value!r}")

    hour = int(hour_str)
    minute = int(minute_str)
    second = int(second_str)
    return datetime.datetime(
        year,
        month,
        day,
        hour,
        minute,
        second,
        microsecond,
        tzinfo=TZ_SHANGHAI,
    )


TZ_SHANGHAI = ZoneInfo("Asia/Shanghai")
"""默认时区: 上海."""


def timestamp_to_datetime(
    ts_seconds: float,
    tzinfo: ZoneInfo | None = TZ_SHANGHAI,
) -> datetime.datetime:
    """将秒级时间戳转换为指定时区的 ``datetime``."""

    return datetime.datetime.fromtimestamp(ts_seconds, tzinfo)
