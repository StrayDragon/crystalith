"""Text processing utilities."""

from __future__ import annotations


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace in text."""
    return " ".join(text.strip().split())


def question_key(text: str) -> str:
    """Generate a normalized key for question deduplication."""
    return normalize_whitespace(text).lower()


def is_valid_question(text: str) -> bool:
    """Check if text is a valid question."""
    if len(text) < 6:
        return False
    lowered = text.lower()
    if lowered.startswith("```"):
        return False
    return True


def parse_bullets(text: str) -> list[str]:
    """Parse bullet points from text."""
    items: list[str] = []
    for raw in text.splitlines():
        cleaned = raw.strip().lstrip("-").strip()
        if cleaned:
            items.append(cleaned)
    return items
