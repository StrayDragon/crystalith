from __future__ import annotations

import pytest

from crystalith.shared.source_connectors.paths import (
    normalize_directory_path,
    normalize_file_path,
    normalize_relative_path,
    path_in_scope,
)


def test_normalize_relative_path_rewrites_separators() -> None:
    assert normalize_relative_path("foo\\bar.md") == "foo/bar.md"


@pytest.mark.parametrize(
    "value",
    [
        "",
        "   ",
        "/abs/path.md",
        "//server/share/path.md",
        "C:/abs/path.md",
        "./rel/path.md",
        "../rel/path.md",
        "foo/./bar.md",
        "foo/../bar.md",
    ],
)
def test_normalize_relative_path_rejects_invalid(value: str) -> None:
    with pytest.raises(ValueError):
        normalize_relative_path(value)


def test_normalize_directory_path_strips_trailing_slash() -> None:
    assert normalize_directory_path("notes/") == "notes"


def test_normalize_file_path_strips_trailing_slash() -> None:
    assert normalize_file_path("notes/a.md/") == "notes/a.md"


def test_path_in_scope_matches_files_exactly() -> None:
    assert path_in_scope("a/b.md", include_directories=[], include_files=["a/b.md"]) is True
    assert path_in_scope("a/b.md", include_directories=[], include_files=["a/c.md"]) is False


def test_path_in_scope_matches_directory_prefix_boundary() -> None:
    assert path_in_scope("foo/bar.md", include_directories=["foo"], include_files=[]) is True
    assert path_in_scope("foobar/bar.md", include_directories=["foo"], include_files=[]) is False

