from __future__ import annotations

import json
from collections.abc import Mapping


UI_ENVELOPE_MARKER = "[[crystalith-ui:v1]]"
UI_ENVELOPE_DELIMITER = f"\n\n{UI_ENVELOPE_MARKER}\n"


def strip_ui_envelope(content: str) -> str:
    if not content:
        return content
    if UI_ENVELOPE_DELIMITER not in content:
        return content
    fallback_text, _, _ = content.partition(UI_ENVELOPE_DELIMITER)
    return fallback_text


def embed_ui_envelope(fallback_text: str, envelope: Mapping[str, object]) -> str:
    if not fallback_text or not fallback_text.strip():
        raise ValueError("fallback_text must be non-empty")
    payload = json.dumps(envelope, ensure_ascii=False, separators=(",", ":"))
    return f"{fallback_text}{UI_ENVELOPE_DELIMITER}{payload}"

