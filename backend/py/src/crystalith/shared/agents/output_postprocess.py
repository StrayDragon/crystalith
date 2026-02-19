from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from crystalith.shared.agents.generation_preference import GenerationPreference
from crystalith.shared.types import OutputType


@dataclass(frozen=True, slots=True)
class PostprocessResult:
    content: dict[str, Any]
    warnings: list[str]


def fallback_output(output_type: OutputType, prompt_title: str) -> dict[str, Any]:
    title = prompt_title or ""
    error_note = "⚠️ AI 模型生成失败，请稍后重试或使用更强大的模型。"

    if output_type == OutputType.FAQ:
        return {
            "items": [
                {
                    "question": title,
                    "answer": error_note,
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.GUIDE:
        return {
            "modules": [
                {
                    "title": title,
                    "objective": {"text": error_note, "citations": []},
                    "key_points": [],
                    "examples": [],
                    "exercises": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.TIMELINE:
        return {
            "events": [
                {
                    "date": "—",
                    "event": title,
                    "description": error_note,
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.MINDMAP:
        return {
            "root": {
                "label": title or error_note,
                "citations": [],
                "children": [],
            },
            "_fallback": True,
        }
    if output_type == OutputType.QUIZ:
        return {
            "questions": [
                {
                    "type": "short_answer",
                    "question": title,
                    "options": [],
                    "answer": error_note,
                    "explanation": "",
                    "citations": [],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.BRIEFING:
        return {
            "sections": [
                {
                    "heading": title or "生成失败",
                    "points": [{"text": error_note, "citations": []}],
                }
            ],
            "_fallback": True,
        }
    if output_type == OutputType.PARAGRAPH:
        return {"text": error_note, "citations": [], "_fallback": True}
    if output_type == OutputType.BULLETS:
        return {"items": [{"text": error_note, "citations": []}], "_fallback": True}
    if output_type == OutputType.STRUCTURED:
        return {
            "title": title or "生成失败",
            "bullets": [{"text": error_note, "citations": []}],
            "terms": [],
            "_fallback": True,
        }
    return {"_fallback": True}


def ensure_minimum_content(
    output_type: OutputType,
    content: Any,
    prompt_title: str,
) -> dict[str, Any]:
    if not isinstance(content, dict):
        return fallback_output(output_type, prompt_title)

    if output_type == OutputType.FAQ:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return fallback_output(output_type, prompt_title)
        return content

    if output_type == OutputType.GUIDE:
        modules = content.get("modules")
        if not isinstance(modules, list) or not modules:
            return fallback_output(output_type, prompt_title)
        for module in modules:
            if not isinstance(module, dict):
                continue
            if not module.get("objective"):
                module["objective"] = {"text": "", "citations": [1]}
            if not module.get("key_points"):
                module["key_points"] = [{"text": "", "citations": [1]}]
            if not isinstance(module.get("examples"), list):
                module["examples"] = []
            if not isinstance(module.get("exercises"), list):
                module["exercises"] = []
        return content

    if output_type == OutputType.TIMELINE:
        events = content.get("events")
        if not isinstance(events, list) or not events:
            return fallback_output(output_type, prompt_title)
        return content

    if output_type == OutputType.MINDMAP:
        root = content.get("root")
        if not isinstance(root, dict):
            return fallback_output(output_type, prompt_title)
        if not root.get("citations"):
            root["citations"] = [1]
        children = root.get("children")
        if not isinstance(children, list) or not children:
            label = str(root.get("label") or prompt_title or "Topic")
            root["children"] = [{"label": label, "citations": [1], "children": []}]
        return content

    if output_type == OutputType.QUIZ:
        questions = content.get("questions")
        if not isinstance(questions, list) or not questions:
            return fallback_output(output_type, prompt_title)
        return content

    if output_type == OutputType.BRIEFING:
        sections = content.get("sections")
        if not isinstance(sections, list) or not sections:
            return fallback_output(output_type, prompt_title)
        for section in sections:
            if not isinstance(section, dict):
                continue
            if not section.get("points"):
                section["points"] = [{"text": "", "citations": [1]}]
        return content

    if output_type == OutputType.PARAGRAPH:
        text = content.get("text")
        if not isinstance(text, str) or not text.strip():
            return fallback_output(output_type, prompt_title)
        citations = content.get("citations")
        if not isinstance(citations, list) or not citations:
            content["citations"] = [1]
        return content

    if output_type == OutputType.BULLETS:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return fallback_output(output_type, prompt_title)
        return content

    if output_type == OutputType.STRUCTURED:
        bullets = content.get("bullets")
        if not isinstance(bullets, list) or not bullets:
            return fallback_output(output_type, prompt_title)
        return content

    return content


def needs_repair(output_type: OutputType, content: Any) -> bool:
    if not isinstance(content, dict):
        return True
    if content.get("_fallback") is True:
        return False

    def is_blank(value: Any) -> bool:
        return not isinstance(value, str) or not value.strip()

    if output_type == OutputType.FAQ:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return True
        for item in items:
            if not isinstance(item, dict):
                return True
            if is_blank(item.get("question")) or is_blank(item.get("answer")):
                return True
        return False
    if output_type == OutputType.GUIDE:
        modules = content.get("modules")
        if not isinstance(modules, list) or not modules:
            return True
        for module in modules:
            if not isinstance(module, dict):
                return True
            if is_blank(module.get("title")):
                return True
            objective = module.get("objective")
            if not isinstance(objective, dict) or is_blank(objective.get("text")):
                return True
            key_points = module.get("key_points")
            if not isinstance(key_points, list) or not key_points:
                return True
            for item in key_points:
                if not isinstance(item, dict) or is_blank(item.get("text")):
                    return True
        return False
    if output_type == OutputType.TIMELINE:
        events = content.get("events")
        if not isinstance(events, list) or not events:
            return True
        for event in events:
            if not isinstance(event, dict):
                return True
            if is_blank(event.get("event")) or is_blank(event.get("description")):
                return True
        return False
    if output_type == OutputType.MINDMAP:
        root = content.get("root")
        if not isinstance(root, dict):
            return True
        if is_blank(root.get("label")):
            return True
        children = root.get("children")
        if not isinstance(children, list) or not children:
            return True
        return False
    if output_type == OutputType.QUIZ:
        questions = content.get("questions")
        if not isinstance(questions, list) or not questions:
            return True
        for question in questions:
            if not isinstance(question, dict):
                return True
            if is_blank(question.get("question")) or is_blank(question.get("answer")):
                return True
        return False
    if output_type == OutputType.BRIEFING:
        sections = content.get("sections")
        if not isinstance(sections, list) or not sections:
            return True
        for section in sections:
            if not isinstance(section, dict):
                return True
            if is_blank(section.get("heading")):
                return True
            points = section.get("points")
            if not isinstance(points, list) or not points:
                return True
            for point in points:
                if not isinstance(point, dict) or is_blank(point.get("text")):
                    return True
        return False
    if output_type == OutputType.PARAGRAPH:
        text = content.get("text")
        return is_blank(text)
    if output_type == OutputType.BULLETS:
        items = content.get("items")
        if not isinstance(items, list) or not items:
            return True
        for item in items:
            if not isinstance(item, dict) or is_blank(item.get("text")):
                return True
        return False
    if output_type == OutputType.STRUCTURED:
        bullets = content.get("bullets")
        title = content.get("title")
        if is_blank(title):
            return True
        if not isinstance(bullets, list) or not bullets:
            return True
        for bullet in bullets:
            if not isinstance(bullet, dict) or is_blank(bullet.get("text")):
                return True
        return False
    return False


def _sanitize_citation_list(value: Any, *, max_index: int) -> tuple[list[int], bool]:
    if not isinstance(value, list):
        return [], value is not None
    if max_index <= 0:
        return [], bool(value)

    changed = False
    output: list[int] = []
    seen: set[int] = set()
    for item in value:
        try:
            index = int(item)
        except (TypeError, ValueError):
            changed = True
            continue
        if index <= 0 or index > max_index:
            changed = True
            continue
        if index in seen:
            changed = True
            continue
        seen.add(index)
        output.append(index)

    if not changed and len(output) != len(value):
        changed = True
    return output, changed


def sanitize_citations_indices(payload: Any, *, citations_count: int) -> tuple[Any, bool]:
    changed = False

    if isinstance(payload, dict):
        mapped: dict[str, Any] = {}
        for key, value in payload.items():
            if key == "citations":
                sanitized, list_changed = _sanitize_citation_list(value, max_index=citations_count)
                mapped[key] = sanitized
                changed = changed or list_changed
            else:
                nested, nested_changed = sanitize_citations_indices(value, citations_count=citations_count)
                mapped[key] = nested
                changed = changed or nested_changed
        return mapped, changed

    if isinstance(payload, list):
        items: list[Any] = []
        for item in payload:
            nested, nested_changed = sanitize_citations_indices(item, citations_count=citations_count)
            items.append(nested)
            changed = changed or nested_changed
        return items, changed

    return payload, False


def postprocess_output(
    *,
    output_type: OutputType,
    content: Any,
    prompt_title: str,
    citations_count: int,
    preference: GenerationPreference | None = None,
    apply_structural: bool = True,
) -> PostprocessResult:
    warnings: list[str] = []

    normalized: Any = content
    if apply_structural:
        normalized = ensure_minimum_content(output_type, normalized, prompt_title)
        if normalized is not content:
            warnings.append("content_normalized")

    sanitized, citations_changed = sanitize_citations_indices(normalized, citations_count=citations_count)
    if citations_changed:
        warnings.append("citations_sanitized")

    if not isinstance(sanitized, dict):
        sanitized = {"value": sanitized}
        warnings.append("content_wrapped")

    if warnings:
        sanitized["_warnings"] = warnings
    sanitized["_postprocessed"] = True

    return PostprocessResult(content=sanitized, warnings=warnings)
