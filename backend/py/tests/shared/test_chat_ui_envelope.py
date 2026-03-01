from __future__ import annotations

import pytest

from crystalith.shared.chat_ui_envelope import (
    UI_ENVELOPE_DELIMITER,
    embed_ui_envelope,
    strip_ui_envelope,
)


def test_strip_ui_envelope_returns_content_when_no_delimiter() -> None:
    assert strip_ui_envelope("hello") == "hello"


def test_strip_ui_envelope_returns_fallback_text_before_delimiter() -> None:
    content = f"fallback{UI_ENVELOPE_DELIMITER}{{\"schema\":\"crystalith.ui.message.v1\",\"parts\":[]}}"
    assert strip_ui_envelope(content) == "fallback"


def test_embed_ui_envelope_roundtrips_strip() -> None:
    content = embed_ui_envelope(
        "fallback",
        {"schema": "crystalith.ui.message.v1", "parts": []},
    )
    assert strip_ui_envelope(content) == "fallback"


def test_embed_ui_envelope_rejects_empty_fallback() -> None:
    with pytest.raises(ValueError, match="fallback_text"):
        embed_ui_envelope("   ", {"schema": "crystalith.ui.message.v1", "parts": []})

