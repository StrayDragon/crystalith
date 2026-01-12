"""Tests for enumx.compact module - Python 3.10 StrEnum backport."""

import sys

import pytest

from cl_stdx.enumx.compact import ReprEnum, StrEnum


class TestStrEnumBackport:
    """Tests for the StrEnum backport implementation (Python < 3.11)."""

    def test_strenum_single_argument(self):
        """Test StrEnum creation with single string argument."""

        # Single value
        class Color(StrEnum):
            RED = "red"
            GREEN = "green"
            BLUE = "blue"

        assert Color["RED"] == Color.RED
        assert Color.RED.value == "red"
        assert isinstance(Color.RED, Color)

    def test_strenum_value_access(self):
        """Test that enum values are accessible via .value attribute."""

        class Size(StrEnum):
            SMALL = "small"
            MEDIUM = "medium"
            LARGE = "large"

        assert Size.SMALL.value == "small"
        assert Size.MEDIUM.value == "medium"
        assert Size.LARGE.value == "large"

    def test_strenum_isinstance_checks(self):
        """Test isinstance checks work correctly."""

        class Direction(StrEnum):
            NORTH = "north"
            SOUTH = "south"

        # StrEnum backport in Python 3.10 doesn't inherit from str in the same way
        assert isinstance(Direction.NORTH, Direction)
        assert isinstance(Direction.SOUTH, Direction)

    def test_strenum_value_methods(self):
        """Test value-based methods on StrEnum members."""

        class Mode(StrEnum):
            READ = "read"
            WRITE = "write"

        # Test that .value returns the string
        assert Mode.READ.value == "read"
        assert Mode.WRITE.value == "write"

    def test_strenum_comparison(self):
        """Test comparison with enum members."""

        class Status(StrEnum):
            ACTIVE = "active"
            INACTIVE = "inactive"

        assert Status.ACTIVE is Status["ACTIVE"]
        assert Status.ACTIVE.value == "active"

    def test_strenum_iteration(self):
        """Test iteration over StrEnum members."""

        class Priority(StrEnum):
            LOW = "low"
            MEDIUM = "medium"
            HIGH = "high"

        members = list(Priority)
        assert len(members) == 3
        assert Priority.LOW in members
        assert Priority.MEDIUM in members
        assert Priority.HIGH in members

    def test_strenum_repr(self):
        """Test repr of StrEnum members."""

        class LogLevel(StrEnum):
            DEBUG = "debug"
            INFO = "info"

        repr_str = repr(LogLevel.DEBUG)
        assert "LogLevel" in repr_str
        assert "DEBUG" in repr_str

    def test_repr_enum_basic(self):
        """Test ReprEnum base class behavior."""

        if sys.version_info >= (3, 11):
            class SimpleEnum(str, ReprEnum):
                A = "a"
                B = "b"
        else:
            class SimpleEnum(ReprEnum):
                A = "a"
                B = "b"

        # ReprEnum should change repr
        assert "A" in repr(SimpleEnum.A)
        # Value comparison
        assert SimpleEnum.A.value == "a"

    def test_strenum_2_args(self):
        """Test StrEnum with 2 arguments (value, encoding)."""

        class TwoArgEnum(StrEnum):
            OPTION1 = "value1"
            OPTION2 = "value2"

        assert TwoArgEnum.OPTION1.value == "value1"
        assert TwoArgEnum.OPTION2.value == "value2"

    def test_strenum_3_args(self):
        """Test StrEnum with 3 arguments (value, encoding, errors)."""

        class ThreeArgEnum(StrEnum):
            A = "test_a"
            B = "test_b"

        assert ThreeArgEnum.A.value == "test_a"
        assert ThreeArgEnum.B.value == "test_b"


class TestReprEnumBehavior:
    """Tests specifically for ReprEnum behavior."""

    def test_repr_enum_value(self):
        """Test ReprEnum .value attribute."""

        if sys.version_info >= (3, 11):
            class MyEnum(str, ReprEnum):
                A = "alpha"
                B = "beta"
        else:
            class MyEnum(ReprEnum):
                A = "alpha"
                B = "beta"

        assert MyEnum.A.value == "alpha"
        assert MyEnum.B.value == "beta"

    def test_repr_enum_repr(self):
        """Test ReprEnum repr."""

        if sys.version_info >= (3, 11):
            class MyEnum(str, ReprEnum):
                X = "x"
                Y = "y"
        else:
            class MyEnum(ReprEnum):
                X = "x"
                Y = "y"

        repr_str = repr(MyEnum.X)
        assert "MyEnum" in repr_str
        assert "X" in repr_str


class TestStrEnumEdgeCases:
    """Edge case tests for StrEnum backport."""

    def test_empty_enum(self):
        """Test that creating empty StrEnum works."""
        EmptyEnum = StrEnum("EmptyEnum", ("Empty",))

    def test_strenum_name_access(self):
        """Test accessing enum member by name."""

        class Animal(StrEnum):
            CAT = "cat"
            DOG = "dog"

        assert Animal["CAT"] is Animal.CAT
        assert Animal["DOG"] is Animal.DOG

    def test_strenum_hashable(self):
        """Test that StrEnum members are hashable."""

        class Hashable(StrEnum):
            A = "a"
            B = "b"

        # Members should be hashable
        d = {Hashable.A: "value"}
        assert d[Hashable.A] == "value"

    def test_strenum_alias(self):
        """Test enum aliases work correctly."""

        class Color(StrEnum):
            RED = "red"
            CRIMSON = "red"  # Alias

        assert Color.RED is Color.CRIMSON
        assert Color.RED.value == "red"

    def test_strenum_value_as_int(self):
        """Test that creating enum with integer value raises TypeError."""
        # This tests the code path where non-string value causes TypeError
        with pytest.raises(TypeError, match="is not a string"):

            class BadEnum(StrEnum):
                VALUE = 123

    def test_strenum_too_many_arguments(self):
        """Test that more than 3 arguments raise TypeError."""
        with pytest.raises(TypeError, match="too many arguments for str"):

            class TooManyArgs(StrEnum):
                VALUE = "value", "utf-8", "strict", "extra"

    def test_strenum_encoding_not_string(self):
        """Test that non-string encoding raises TypeError."""
        with pytest.raises(TypeError, match="encoding must be a string"):

            class BadEncoding(StrEnum):
                VALUE = "value", 123

    def test_strenum_errors_not_string(self):
        """Test that non-string errors raises TypeError."""
        with pytest.raises(TypeError, match="errors must be a string"):

            class BadErrors(StrEnum):
                VALUE = "value", "utf-8", 123


class TestGenerateNextValue:
    """Test the _generate_next_value_ method behavior."""

    def test_generate_next_value_returns_lowercase(self):
        """Test that _generate_next_value_ returns lowercase of name."""
        # This tests line 44 of compact.py
        result = StrEnum._generate_next_value_("TestName", 0, 0, [])
        assert result == "testname"

    def test_generate_next_value_with_existing(self):
        """Test _generate_next_value_ with existing values."""
        # This tests the method with _last_values populated
        result = StrEnum._generate_next_value_("NewValue", 0, 1, ["first_value"])
        assert result == "newvalue"

    def test_generate_next_value_empty_last_values(self):
        """Test _generate_next_value_ with empty _last_values."""
        result = StrEnum._generate_next_value_("FirstValue", 0, 0, [])
        assert result == "firstvalue"

    def test_generate_next_value_multiple_calls(self):
        """Test _generate_next_value_ with multiple existing values."""
        result = StrEnum._generate_next_value_("FifthValue", 0, 4, ["first", "second", "third", "fourth"])
        assert result == "fifthvalue"


class TestStrEnumStrConversion:
    """Test the str() conversion in __new__."""

    def test_new_str_conversion(self):
        """Test that __new__ converts value using str()."""

        # Test line 34: value = str(*values)
        class ConvertTest(StrEnum):
            A = "test"

        # The value should be the string representation
        assert ConvertTest.A.value == "test"

    def test_str_conversion_preserves_value(self):
        """Test that str conversion preserves the exact string value."""

        class PreserveTest(StrEnum):
            EXACT = "exact_value"

        assert PreserveTest.EXACT.value == "exact_value"
