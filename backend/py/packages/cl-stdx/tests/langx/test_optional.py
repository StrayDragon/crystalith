"""OptionT 单元测试."""

import pytest
from cl_stdx import OptionT


class TestOptionTBasics:
    def test_create_with_value(self) -> None:
        opt = OptionT[int](42)
        assert opt.unwrap() == 42

    def test_create_without_value(self) -> None:
        opt = OptionT[int]()
        with pytest.raises(ValueError, match="OptionT value is None"):
            opt.unwrap()

    def test_unwrap_or(self) -> None:
        opt = OptionT[int]()
        assert opt.unwrap_or(7) == 7


class TestOptionTRepresentation:
    def test_repr_and_str(self) -> None:
        opt = OptionT[str]("hello")
        assert repr(opt) == "OptionT('hello')"
        assert str(opt) == "hello"

        empty = OptionT[str]()
        assert repr(empty) == "OptionT(None)"
        assert str(empty) == "None"


class TestOptionTEquality:
    def test_eq_and_hash(self) -> None:
        opt1 = OptionT[int](42)
        opt2 = OptionT[int](42)
        opt3 = OptionT[int](43)

        assert opt1 == opt2
        assert opt1 != opt3
        assert hash(opt1) == hash(opt2)

    def test_eq_with_non_optiont(self) -> None:
        """Test __eq__ with non-OptionT objects (line 50)."""
        opt = OptionT[int](42)

        # Comparison with non-OptionT should return False
        assert (opt == 42) is False
        assert (opt == "hello") is False
        assert (opt is None) is False
        assert (opt == [1, 2, 3]) is False

    def test_eq_with_none(self) -> None:
        """Test equality comparison with None."""
        opt_with_value = OptionT[int](0)  # 0 is a valid value
        opt_empty = OptionT[int]()

        # OptionT with value should not equal None
        assert (opt_with_value is None) is False
        # Empty OptionT should not equal None either (it's not the same type)
        assert (opt_empty is None) is False


class TestOptionTChecks:
    def test_bool(self) -> None:
        assert bool(OptionT[str]("")) is True
        assert bool(OptionT[str]()) is False

    def test_is_some(self) -> None:
        assert OptionT[int](0).is_some() is True
        assert OptionT[int]().is_some() is False

    def test_is_none(self) -> None:
        """Test is_none method (line 34)."""
        opt_with_value = OptionT[str]("test")
        opt_empty = OptionT[str]()

        assert opt_with_value.is_none() is False
        assert opt_empty.is_none() is True

    def test_bool_with_falsy_value(self) -> None:
        """Test __bool__ with falsy but non-None values."""
        opt_zero = OptionT[int](0)
        opt_empty_str = OptionT[str]("")
        opt_false = OptionT[bool](False)

        # All should be True because they have values (just falsy)
        assert bool(opt_zero) is True
        assert bool(opt_empty_str) is True
        assert bool(opt_false) is True


class TestOptionTAdvanced:
    def test_unwrap_panics_correctly(self) -> None:
        """Test that unwrap raises ValueError with correct message."""
        opt = OptionT[str]()

        with pytest.raises(ValueError, match="OptionT value is None"):
            opt.unwrap()

    def test_unwrap_or_with_none_value(self) -> None:
        """Test unwrap_or when value is None."""
        opt = OptionT[list[str]]()
        default = ["default"]

        result = opt.unwrap_or(default)
        assert result == default

    def test_unwrap_or_with_value(self) -> None:
        """Test unwrap_or when value exists."""
        opt = OptionT[int](42)
        default = 100

        result = opt.unwrap_or(default)
        assert result == 42
        assert result != default

    def test_hash_consistency(self) -> None:
        """Test that hash is consistent across calls."""
        opt1 = OptionT[str]("test")
        opt2 = OptionT[str]("test")

        # Same value should have same hash
        assert hash(opt1) == hash(opt2)

    def test_hash_none_value(self) -> None:
        """Test hash when value is None."""
        opt = OptionT[str]()
        # Hash of None is consistent
        assert hash(opt) == hash(None)

    def test_hash_different_types(self) -> None:
        """Test hash with different types."""
        opt_int = OptionT[int](42)
        opt_str = OptionT[str]("42")

        # Different types with same value should have different hashes
        assert hash(opt_int) != hash(opt_str)

    def test_repr_format(self) -> None:
        """Test repr formatting."""
        opt_with_value = OptionT[int](123)
        opt_empty = OptionT[str]()

        assert "OptionT(123)" in repr(opt_with_value)
        assert "OptionT(None)" in repr(opt_empty)

    def test_str_format(self) -> None:
        """Test str formatting."""
        opt_with_value = OptionT[str]("hello")
        opt_empty = OptionT[str]()

        assert str(opt_with_value) == "hello"
        assert str(opt_empty) == "None"
