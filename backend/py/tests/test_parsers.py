from __future__ import annotations

import pytest

from crystalith.parsers import (
    AudioParser,
    HTMLParser,
    MediaSource,
    ParserError,
    ParserFactory,
    PDFParser,
    TextParser,
    VideoParser,
)


class FakeTranscriber:
    provider = "fake"
    model = "fake"

    def __init__(self, text: str = "transcript") -> None:
        self._text = text

    def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
        return self._text


class FakeMediaFetcher:
    def __init__(self, content: bytes, *, mime_type: str | None = None, filename: str | None = None) -> None:
        self._media = MediaSource(content=content, mime_type=mime_type, filename=filename)

    def fetch(self, url: str) -> MediaSource:
        return self._media


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf(text: str) -> bytes:
    escaped = _escape_pdf_text(text)
    stream = f"BT\n/F1 24 Tf\n72 72 Td\n({escaped}) Tj\nET\n"
    objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            "3 0 obj\n"
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\n"
            "endobj\n"
        ),
        f"4 0 obj\n<< /Length {len(stream)} >>\nstream\n{stream}endstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]

    content = "%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(content))
        content += obj

    xref_offset = len(content)
    xref_lines = ["xref", "0 6", "0000000000 65535 f "]
    xref_lines.extend(f"{offset:010d} 00000 n " for offset in offsets[1:])
    xref = "\n".join(xref_lines) + "\n"
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"

    return (content + xref + trailer).encode("ascii")


def test_text_parser_paragraphs() -> None:
    parser = TextParser()
    content = b"First paragraph.\n\nSecond line 1\nSecond line 2\n\n"
    chunks = parser.parse(content)

    assert [chunk.text.strip() for chunk in chunks] == [
        "First paragraph.",
        "Second line 1\nSecond line 2",
    ]
    assert chunks[0].start_offset == 0
    assert chunks[0].end_offset is not None


def test_html_parser_extracts_main_content() -> None:
    parser = HTMLParser()
    html = (
        b"<html><body>"
        b"<nav>Nav</nav>"
        b"<main><p>Main content</p><p>Second</p></main>"
        b"<footer>Footer</footer>"
        b"</body></html>"
    )
    chunks = parser.parse(html)
    combined = "\n".join(chunk.text for chunk in chunks)

    assert "Main content" in combined
    assert "Second" in combined
    assert "Nav" not in combined
    assert "Footer" not in combined


def test_pdf_parser_extracts_text_with_page_metadata() -> None:
    parser = PDFParser()
    content = _build_pdf("Hello PDF")
    chunks = parser.parse(content)

    assert chunks
    assert any("Hello PDF" in chunk.text for chunk in chunks)
    assert all(chunk.metadata.get("page") == 1 for chunk in chunks)
    assert all(chunk.metadata.get("paragraph_index") == 0 for chunk in chunks)
    assert parser.page_count == 1


def test_pdf_parser_invalid_pdf_raises() -> None:
    parser = PDFParser()
    with pytest.raises(ParserError):
        parser.parse(b"not a pdf")


def test_parser_factory_selects_by_mime_and_extension() -> None:
    parser = ParserFactory.from_file(filename="note.md", mime_type=None)
    assert isinstance(parser, TextParser)

    parser = ParserFactory.from_file(filename=None, mime_type="text/html")
    assert isinstance(parser, HTMLParser)

    parser = ParserFactory.from_file(filename="doc.pdf", mime_type=None)
    assert isinstance(parser, PDFParser)


def test_audio_parser_transcribes_to_chunks() -> None:
    parser = AudioParser(FakeTranscriber("hello world"), filename="song.mp3", mime_type="audio/mpeg")
    chunks = parser.parse(b"audio")

    assert [chunk.text for chunk in chunks] == ["hello world"]


def test_video_parser_transcribes_from_url() -> None:
    fetcher = FakeMediaFetcher(b"video-bytes", mime_type="video/mp4", filename="clip.mp4")
    parser = VideoParser(
        FakeTranscriber("video transcript"),
        source_url="https://youtu.be/example",
        media_fetcher=fetcher,
    )
    chunks = parser.parse(b"")

    assert [chunk.text for chunk in chunks] == ["video transcript"]


def test_parser_factory_selects_audio_video_and_youtube() -> None:
    transcriber = FakeTranscriber()

    parser = ParserFactory.from_file(filename="song.mp3", mime_type=None, transcriber=transcriber)
    assert isinstance(parser, AudioParser)

    parser = ParserFactory.from_file(filename="clip.mp4", mime_type=None, transcriber=transcriber)
    assert isinstance(parser, VideoParser)

    parser = ParserFactory.from_file(
        filename="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        mime_type=None,
        transcriber=transcriber,
    )
    assert isinstance(parser, VideoParser)
