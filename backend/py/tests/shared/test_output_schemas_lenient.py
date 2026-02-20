from __future__ import annotations

from crystalith.shared.agents.output_schemas import BulletsOutput, CitedText, ParagraphOutput, StructuredOutput


def test_cited_text_accepts_string_input() -> None:
    output = CitedText.model_validate("hello world")
    assert output.text == "hello world"
    assert output.citations == []


def test_citations_normalizes_common_shapes() -> None:
    output = CitedText.model_validate({"text": "x", "citations": "1, 2, 2, 0"})
    assert output.citations == [1, 2]

    output = CitedText.model_validate({"text": "x", "citations": [1, "2", "2", None, {"bad": True}]})
    assert output.citations == [1, 2]

    output = CitedText.model_validate({"text": "x", "citations": {"not": "a list"}})
    assert output.citations == []


def test_bullets_schema_accepts_list_strings_and_ignores_extra_keys() -> None:
    parsed = BulletsOutput.model_validate(
        {
            "items": ["a", {"text": "b", "citations": "2", "extra": "ignored"}],
            "unexpected": True,
        }
    )
    dumped = parsed.model_dump()
    assert dumped == {
        "items": [
            {"text": "a", "citations": []},
            {"text": "b", "citations": [2]},
        ]
    }


def test_structured_schema_accepts_bullets_as_strings() -> None:
    parsed = StructuredOutput.model_validate(
        {
            "title": "t",
            "bullets": ["a", {"text": "b", "citations": ["3", "3"]}],
            "terms": [],
            "unexpected": {"ignored": True},
        }
    )
    dumped = parsed.model_dump()
    assert dumped["title"] == "t"
    assert dumped["bullets"] == [
        {"text": "a", "citations": []},
        {"text": "b", "citations": [3]},
    ]


def test_paragraph_schema_accepts_citations_as_string() -> None:
    parsed = ParagraphOutput.model_validate({"text": "x", "citations": "1,2"})
    assert parsed.model_dump() == {"text": "x", "citations": [1, 2]}
