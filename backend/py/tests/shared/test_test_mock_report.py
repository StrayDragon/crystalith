from __future__ import annotations

import scripts.test_mock_report as report


def test_private_patch_targets_detects_monkeypatch_setattr_string_target() -> None:
    content = """
def test_example(monkeypatch):
    monkeypatch.setattr("pkg.mod._private", 1)
"""

    assert report._private_patch_targets(content) == ["pkg.mod._private"]


def test_private_patch_targets_detects_monkeypatch_setattr_object_name() -> None:
    content = """
def test_example(monkeypatch):
    monkeypatch.setattr(object(), "_private", 1)
"""

    assert report._private_patch_targets(content) == ["_private"]


def test_private_patch_targets_detects_unittest_patch_target_and_ignores_comment() -> None:
    content = """
from unittest.mock import patch

# patch("pkg.mod._commented")

@patch("pkg.mod._private")
def test_example():
    return None
"""

    assert report._private_patch_targets(content) == ["pkg.mod._private"]


def test_private_patch_targets_detects_patch_object_attribute() -> None:
    content = """
from unittest.mock import patch

def test_example():
    patch.object(object(), "_private")
"""

    assert report._private_patch_targets(content) == ["_private"]


def test_private_patch_targets_evaluates_simple_string_concat_in_patch_target() -> None:
    content = """
from unittest.mock import patch

def test_example():
    patch("pkg.mod." + "_private")
"""

    assert report._private_patch_targets(content) == ["pkg.mod._private"]
