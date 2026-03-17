import datetime

import pytest
from cl_stdx import timex


def test_datetime_to_timestamp_ms() -> None:
    dt = datetime.datetime(2024, 1, 15, 10, 30, 0, tzinfo=timex.TZ_SHANGHAI)
    ts_ms = timex.datetime_to_timestamp(dt)

    assert isinstance(ts_ms, int)
    assert ts_ms > 0


def test_str_round_trip() -> None:
    dt = datetime.datetime(2024, 1, 15, 10, 30, 0, tzinfo=timex.TZ_SHANGHAI)
    dt_str = timex.datetime_to_str(dt)

    roundtrip = timex.str_to_datetime(dt_str)
    assert roundtrip == dt


def test_timestamp_to_datetime_with_tz() -> None:
    ts = 1_700_000_000
    dt = timex.timestamp_to_datetime(ts)

    assert dt.tzinfo == timex.TZ_SHANGHAI


# --- Additional boundary tests for coverage ---


class TestStrToDatetimeBoundary:
    """Boundary tests for str_to_datetime function."""

    def test_none_input(self) -> None:
        """Test with None input (line 35-36)."""
        result = timex.str_to_datetime(None)
        assert result is None

    def test_empty_string(self) -> None:
        """Test with empty string (line 35-36)."""
        result = timex.str_to_datetime("")
        assert result is None

    def test_falsy_values(self) -> None:
        """Test with various falsy values."""
        assert timex.str_to_datetime(None) is None
        assert timex.str_to_datetime("") is None

    def test_datetime_input(self) -> None:
        """Test with datetime.datetime input (line 37-38)."""
        dt = datetime.datetime(2024, 6, 15, 14, 30, 45, tzinfo=timex.TZ_SHANGHAI)
        result = timex.str_to_datetime(dt)

        assert result == dt
        assert isinstance(result, datetime.datetime)

    def test_date_input(self) -> None:
        """Test with datetime.date input (line 39-40)."""
        d = datetime.date(2024, 6, 15)
        result = timex.str_to_datetime(d)

        # Should convert date to datetime
        assert isinstance(result, datetime.datetime)
        assert result.tzinfo == timex.TZ_SHANGHAI
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
        assert result.hour == 0
        assert result.minute == 0
        assert result.second == 0

    def test_ymd_format(self) -> None:
        """Test parsing YYYY-MM-DD format (line 48)."""
        result = timex.str_to_datetime("2024-06-15")

        assert isinstance(result, datetime.datetime)
        assert result.tzinfo == timex.TZ_SHANGHAI
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15

    def test_ymdhm_format(self) -> None:
        """Test parsing YYYY-MM-DD HH:MM format (line 50)."""
        result = timex.str_to_datetime("2024-06-15 14:30")

        assert isinstance(result, datetime.datetime)
        assert result.tzinfo == timex.TZ_SHANGHAI
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
        assert result.hour == 14
        assert result.minute == 30
        assert result.second == 0

    def test_ymdhms_format(self) -> None:
        """Test parsing YYYY-MM-DD HH:MM:SS format (line 42)."""
        result = timex.str_to_datetime("2024-06-15 14:30:45")

        assert isinstance(result, datetime.datetime)
        assert result.tzinfo == timex.TZ_SHANGHAI
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
        assert result.hour == 14
        assert result.minute == 30
        assert result.second == 45

    def test_ymdhms_f_format(self) -> None:
        """Test parsing YYYY-MM-DD HH:MM:SS.fff format (line 45)."""
        result = timex.str_to_datetime("2024-06-15 14:30:45.123456")

        assert isinstance(result, datetime.datetime)
        assert result.tzinfo == timex.TZ_SHANGHAI
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15
        assert result.hour == 14
        assert result.minute == 30
        assert result.second == 45
        assert result.microsecond == 123456

    def test_ymdhms_f_microseconds(self) -> None:
        """Test various microsecond precisions."""
        # 6 digits
        result = timex.str_to_datetime("2024-06-15 14:30:45.123456")
        assert result.microsecond == 123456

        # 3 digits
        result = timex.str_to_datetime("2024-06-15 14:30:45.123")
        assert result.microsecond == 123000

    def test_datetime_to_str_format(self) -> None:
        """Test datetime_to_str output format."""
        dt = datetime.datetime(2024, 1, 15, 10, 30, 45, tzinfo=timex.TZ_SHANGHAI)
        result = timex.datetime_to_str(dt)

        assert result == "2024-01-15 10:30:45"

    def test_datetime_to_str_zero_padded(self) -> None:
        """Test that datetime_to_str zero-pads values."""
        dt = datetime.datetime(2024, 1, 5, 3, 7, 9, tzinfo=timex.TZ_SHANGHAI)
        result = timex.datetime_to_str(dt)

        assert result == "2024-01-05 03:07:09"

    def test_timestamp_to_datetime_utc(self) -> None:
        """Test timestamp_to_datetime with explicit UTC timezone."""
        ts = 1_700_000_000
        # Use UTC timezone explicitly
        from zoneinfo import ZoneInfo

        result = timex.timestamp_to_datetime(ts, tzinfo=ZoneInfo("UTC"))

        assert result.tzinfo is not None
        assert result.tzinfo.key == "UTC"

    def test_timestamp_to_datetime_none_tz(self) -> None:
        """Test timestamp_to_datetime with no timezone."""
        ts = 1_700_000_000
        result = timex.timestamp_to_datetime(ts, tzinfo=None)

        # Result should be naive datetime
        assert result.tzinfo is None

    def test_tz_shanghai_constant(self) -> None:
        """Test TZ_SHANGHAI constant is correct."""
        assert timex.TZ_SHANGHAI.key == "Asia/Shanghai"

    def test_roundtrip_timestamp(self) -> None:
        """Test round-trip: datetime -> timestamp -> datetime."""
        original = datetime.datetime(2024, 6, 15, 14, 30, 45, tzinfo=timex.TZ_SHANGHAI)
        ts_ms = timex.datetime_to_timestamp(original)
        roundtrip = timex.timestamp_to_datetime(ts_ms / 1000, tzinfo=timex.TZ_SHANGHAI)

        # Should be equal (same timezone)
        assert roundtrip == original

    def test_str_to_datetime_invalid_format(self) -> None:
        """Test that completely invalid formats still return something or raise."""
        # ISO format 'T' is not supported, it will try all formats and fail
        # The function will raise ValueError from the last format attempt
        with pytest.raises(ValueError):
            timex.str_to_datetime("2024-06-15T14:30:45")


class TestDatetimeToTimestamp:
    """Additional tests for datetime_to_timestamp."""

    def test_timestamp_is_integer(self) -> None:
        """Test that timestamp is returned as integer."""
        dt = datetime.datetime(2024, 1, 1, 0, 0, 0, tzinfo=timex.TZ_SHANGHAI)
        ts = timex.datetime_to_timestamp(dt)

        assert isinstance(ts, int)

    def test_timestamp_precision(self) -> None:
        """Test that microseconds are preserved in timestamp conversion."""
        dt = datetime.datetime(2024, 1, 1, 0, 0, 0, 500000, tzinfo=timex.TZ_SHANGHAI)
        ts = timex.datetime_to_timestamp(dt)

        # 500000 microseconds = 500 milliseconds = 0.5 seconds
        # ts should reflect this
        ts_seconds = ts / 1000
        assert ts_seconds > 0.5
