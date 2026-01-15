from __future__ import annotations

from typing import Any

from crystalith.ai.interfaces import ChatProvider

from ..types import OutputContent, OutputType
from .common import (
    build_messages,
    normalize_citation_indices,
    normalize_text,
    normalize_text_list,
    parse_json_payload,
)


class QuizGenerator:
    def __init__(self, chatter: ChatProvider) -> None:
        self._chatter = chatter

    async def generate(self, context: str, prompt: str) -> OutputContent:
        final_prompt = prompt.strip() or "Create a quiz from the sources."
        messages = build_messages(
            OutputType.QUIZ,
            final_prompt,
            context,
            (
                "Return JSON with key 'questions': list of objects with keys "
                "'type' (multiple_choice|true_false|short_answer), "
                "'question' (string), 'options' (list of strings, optional), "
                "'answer' (string), 'explanation' (string), "
                "'citations' (list of source indexes)."
            ),
        )
        answer = await self._chatter.chat(messages)
        payload = parse_json_payload(answer)
        questions = _normalize_questions(payload.get("questions") if payload else None, final_prompt)
        if not questions:
            questions = [_fallback_question(final_prompt)]
        return {"questions": questions}


def _normalize_questions(raw: Any, fallback_prompt: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    questions: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        question_type = normalize_text(item.get("type"), "short_answer")
        if question_type not in {"multiple_choice", "true_false", "short_answer"}:
            question_type = "short_answer"
        questions.append(
            {
                "type": question_type,
                "question": normalize_text(item.get("question"), fallback_prompt),
                "options": normalize_text_list(item.get("options")),
                "answer": normalize_text(item.get("answer")),
                "explanation": normalize_text(item.get("explanation")),
                "citations": normalize_citation_indices(item.get("citations")),
            }
        )
    return questions


def _fallback_question(prompt: str) -> dict[str, Any]:
    return {
        "type": "short_answer",
        "question": prompt,
        "options": [],
        "answer": "",
        "explanation": "",
        "citations": [1],
    }
