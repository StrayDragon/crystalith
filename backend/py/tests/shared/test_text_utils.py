from __future__ import annotations

from crystalith.shared.utils.text import (
    is_valid_question,
    normalize_whitespace,
    parse_bullets,
    question_key,
)


def test_normalize_whitespace_collapses_and_strips() -> None:
    assert normalize_whitespace("  a   b \n c\t") == "a b c"


def test_question_key_lowercases_normalized_text() -> None:
    assert question_key("  Hello   WORLD ") == "hello world"


def test_is_valid_question_rejects_short_or_codeblock() -> None:
    assert is_valid_question("hi?") is False
    assert is_valid_question("```python\nprint(1)\n```") is False
    assert is_valid_question("What is this?") is True


def test_parse_bullets_extracts_non_empty_lines() -> None:
    text = "- a\n - b\nc\n\n-   d  \n"
    assert parse_bullets(text) == ["a", "b", "c", "d"]
