from __future__ import annotations

from io import BytesIO

import pytest
from pypdf import PdfWriter

from crystalith.shared.config import Settings
from crystalith.shared.parsers.audio import AudioParser
from crystalith.shared.parsers.csv import CSVParser
from crystalith.shared.parsers.factory import ParserFactory, _is_youtube_url
from crystalith.shared.parsers.html import HTMLParser
from crystalith.shared.parsers.interfaces import ParserError, UnsupportedDocumentError
from crystalith.shared.parsers.media import MediaSource
from crystalith.shared.parsers.pdf import PDFParser
from crystalith.shared.parsers.text import TextParser
from crystalith.shared.parsers.transcription import (
    DisabledTranscriber,
    OpenAITranscriber,
    create_transcription_provider,
)
from crystalith.shared.parsers.types import Chunk
from crystalith.shared.parsers.utils import chunk_paragraphs
from crystalith.shared.parsers.video import VideoParser
from crystalith.shared.plugins import PluginRegistry


def test_chunk_paragraphs_returns_empty_for_whitespace() -> None:
    assert chunk_paragraphs("   \n\n  ") == []


def test_chunk_paragraphs_splits_paragraphs_and_tracks_offsets() -> None:
    text = "Hello\nworld\n\nSecond\n\n"
    chunks = chunk_paragraphs(text, metadata={"source": "unit"})

    assert [c.text for c in chunks] == ["Hello\nworld", "Second"]
    assert [c.metadata["paragraph_index"] for c in chunks] == [0, 1]
    assert chunks[0].metadata["source"] == "unit"

    assert chunks[0].start_offset == 0
    assert chunks[0].end_offset == 12
    assert chunks[1].start_offset == 13
    assert chunks[1].end_offset == 20


def test_text_parser_decodes_utf8_and_errors_on_invalid_bytes() -> None:
    parser = TextParser()
    chunks = parser.parse(b"Hello\n\nWorld")
    assert [c.text for c in chunks] == ["Hello", "World"]

    with pytest.raises(ParserError, match="UTF-8"):
        parser.parse(b"\xff")


def test_html_parser_strips_boilerplate_and_extracts_text() -> None:
    parser = HTMLParser()
    html = b"""
    <html>
      <head><title>t</title><style>body{}</style></head>
      <body>
        <header>ignore</header>
        <main>
          <p>Keep me</p>
          <script>alert(1)</script>
        </main>
        <footer>ignore</footer>
      </body>
    </html>
    """
    chunks = parser.parse(html)
    assert any("Keep me" in chunk.text for chunk in chunks)
    assert all("ignore" not in chunk.text for chunk in chunks)


def test_audio_parser_transcribes_and_chunks() -> None:
    class _Transcriber:
        provider = "test"
        model = "test"

        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            assert content == b"audio"
            assert filename == "a.mp3"
            assert mime_type == "audio/mpeg"
            return "Hello\n\nWorld"

    parser = AudioParser(_Transcriber(), filename="a.mp3", mime_type="audio/mpeg")
    chunks = parser.parse(b"audio")
    assert [c.text for c in chunks] == ["Hello", "World"]

    with pytest.raises(ParserError, match="Empty audio"):
        parser.parse(b"")

    class _BoomTranscriber(_Transcriber):
        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            raise RuntimeError("boom")

    parser2 = AudioParser(_BoomTranscriber())
    with pytest.raises(ParserError, match="transcription failed"):
        parser2.parse(b"audio")


def test_video_parser_fetches_source_url_then_transcribes() -> None:
    class _Fetcher:
        def fetch(self, url: str) -> MediaSource:
            assert url == "https://youtu.be/abc"
            return MediaSource(content=b"video", mime_type="video/mp4", filename="v.mp4")

    class _Transcriber:
        provider = "test"
        model = "test"

        def __init__(self) -> None:
            self.calls: list[tuple[bytes, str | None, str | None]] = []

        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            self.calls.append((content, filename, mime_type))
            return "Line 1\n\nLine 2"

    transcriber = _Transcriber()
    parser = VideoParser(transcriber, source_url="https://youtu.be/abc", media_fetcher=_Fetcher())
    chunks = parser.parse(b"ignored")
    assert [c.text for c in chunks] == ["Line 1", "Line 2"]
    assert transcriber.calls == [(b"video", "v.mp4", "video/mp4")]

    class _EmptyFetcher(_Fetcher):
        def fetch(self, url: str) -> MediaSource:
            return MediaSource(content=b"")

    parser2 = VideoParser(transcriber, source_url="https://youtu.be/abc", media_fetcher=_EmptyFetcher())
    with pytest.raises(ParserError, match="Empty video"):
        parser2.parse(b"ignored")


def test_openai_transcriber_transcribe_handles_response_shapes_and_errors() -> None:
    class _AudioTranscriptions:
        def __init__(self, response) -> None:  # noqa: ANN001 - test stub
            self._response = response

        def create(self, *, model, file):  # noqa: ANN001 - test stub
            return self._response

    class _Audio:
        def __init__(self, response) -> None:  # noqa: ANN001 - test stub
            self.transcriptions = _AudioTranscriptions(response)

    class _Client:
        def __init__(self, response) -> None:  # noqa: ANN001 - test stub
            self.audio = _Audio(response)

    transcriber = OpenAITranscriber(model="whisper-1", client=_Client("hello"))
    assert transcriber.transcribe(b"data") == "hello"

    response_obj = type("Resp", (), {"text": "hi"})()
    transcriber2 = OpenAITranscriber(model="whisper-1", client=_Client(response_obj))
    assert transcriber2.transcribe(b"data") == "hi"

    response_missing = type("Resp", (), {})()
    transcriber3 = OpenAITranscriber(model="whisper-1", client=_Client(response_missing))
    with pytest.raises(ParserError, match="missing text"):
        transcriber3.transcribe(b"data")

    transcriber4 = OpenAITranscriber(model="whisper-1", client=_Client("x"))
    with pytest.raises(ParserError, match="Empty audio"):
        transcriber4.transcribe(b"")

    class _BoomClient(_Client):
        def __init__(self) -> None:
            self.audio = _AudioTranscriptions(response=None)  # type: ignore[assignment]

    class _BoomAudioTranscriptions:
        def create(self, *, model, file):  # noqa: ANN001 - test stub
            raise RuntimeError("boom")

    boom = OpenAITranscriber(model="whisper-1", client=type("C", (), {"audio": type("A", (), {"transcriptions": _BoomAudioTranscriptions()})()})())
    with pytest.raises(ParserError, match="OpenAI transcription failed"):
        boom.transcribe(b"data")


def test_create_transcription_provider_returns_disabled_when_no_openai_model() -> None:
    settings = Settings(models={"available": []})
    provider = create_transcription_provider(settings)
    assert isinstance(provider, DisabledTranscriber)


def test_create_transcription_provider_returns_disabled_when_api_key_missing() -> None:
    settings = Settings(
        models={
            "defaults": {"chat": "chat"},
            "available": [
                {
                    "id": "chat",
                    "provider": "openai",
                    "model": "gpt",
                    "display_name": "Chat",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "   "},
                }
            ],
        }
    )
    provider = create_transcription_provider(settings)
    assert isinstance(provider, DisabledTranscriber)


def test_create_transcription_provider_returns_openai_transcriber_when_key_present() -> None:
    settings = Settings(
        models={
            "defaults": {"chat": "chat"},
            "available": [
                {
                    "id": "chat",
                    "provider": "openai",
                    "model": "gpt",
                    "display_name": "Chat",
                    "roles": ["chat"],
                    "provider_config": {"api_key": "sk-test", "base_url": "http://localhost:9999"},
                }
            ],
        }
    )
    provider = create_transcription_provider(settings)
    assert isinstance(provider, OpenAITranscriber)
    assert provider.provider == "openai"


def test_parser_factory_selects_youtube_video_parser_and_plugins() -> None:
    assert _is_youtube_url("https://youtu.be/abc") is True
    assert _is_youtube_url("ftp://youtu.be/abc") is False

    registry = PluginRegistry()

    class _Plugin:
        parser_type = "custom"
        supported_mime_types = {"application/x-custom"}
        supported_extensions = {".cstm"}

        def create_parser(self, *, filename, mime_type, transcriber=None, media_fetcher=None):  # noqa: ANN001
            return TextParser()

    registry.parsers["custom"] = _Plugin()

    parser = ParserFactory.from_file(filename="file.cstm", mime_type=None, plugins=registry)
    assert isinstance(parser, TextParser)

    with pytest.raises(UnsupportedDocumentError):
        ParserFactory.from_file(filename="file.bin", mime_type="application/octet-stream")

    class _Fetcher:
        def fetch(self, url: str) -> MediaSource:
            return MediaSource(content=b"video")

    class _Transcriber:
        provider = "test"
        model = "test"

        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            return "ok"

    youtube = ParserFactory.from_file(
        filename="https://youtu.be/abc",
        mime_type=None,
        media_fetcher=_Fetcher(),
        transcriber=_Transcriber(),
    )
    assert isinstance(youtube, VideoParser)
    assert youtube.parse(b"ignored")[0].text == "ok"


def test_parser_factory_selects_parsers_by_mime_and_extension() -> None:
    assert isinstance(ParserFactory.from_file(filename="a.txt", mime_type="text/plain"), TextParser)
    assert isinstance(ParserFactory.from_file(filename="a.html", mime_type="text/html"), HTMLParser)
    assert isinstance(ParserFactory.from_file(filename="a.pdf", mime_type="application/pdf"), PDFParser)
    assert isinstance(ParserFactory.from_file(filename="a.csv", mime_type="text/csv"), CSVParser)
    assert isinstance(ParserFactory.from_file(filename="a.csv", mime_type=None), CSVParser)

    class _Transcriber:
        provider = "test"
        model = "test"

        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            return "ok"

    assert isinstance(
        ParserFactory.from_file(filename="a.mp3", mime_type=None, transcriber=_Transcriber()),
        AudioParser,
    )


def test_csv_parser_chunks_by_rows_and_sets_metadata() -> None:
    parser = CSVParser()
    content = b"a,b\n1,2\n3,4\n"
    chunks = parser.parse(content)
    assert len(chunks) == 1
    assert chunks[0].metadata["csv_row_start"] == 1
    assert chunks[0].metadata["csv_row_end"] == 2
    assert "| a | b |" in chunks[0].text
    assert "| 1 | 2 |" in chunks[0].text

    rows = ["c1,c2"] + [f"{i},{i + 1}" for i in range(55)]
    chunks2 = parser.parse(("\n".join(rows) + "\n").encode("utf-8"))
    assert len(chunks2) == 2
    assert chunks2[0].metadata["csv_row_start"] == 1
    assert chunks2[0].metadata["csv_row_end"] == 50
    assert chunks2[1].metadata["csv_row_start"] == 51
    assert chunks2[1].metadata["csv_row_end"] == 55


def test_pdf_parser_handles_blank_and_encrypted_pdfs() -> None:
    parser = PDFParser()

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buf = BytesIO()
    writer.write(buf)
    chunks = parser.parse(buf.getvalue())
    assert chunks == []
    assert parser.page_count == 1

    # Encrypted PDF with empty password should decrypt successfully.
    writer2 = PdfWriter()
    writer2.add_blank_page(width=72, height=72)
    writer2.encrypt(user_password="")
    buf2 = BytesIO()
    writer2.write(buf2)
    chunks2 = PDFParser().parse(buf2.getvalue())
    assert chunks2 == []

    # Encrypted PDF with password should fail when decrypting with empty string.
    writer3 = PdfWriter()
    writer3.add_blank_page(width=72, height=72)
    writer3.encrypt(user_password="secret")
    buf3 = BytesIO()
    writer3.write(buf3)
    with pytest.raises(ParserError, match="Encrypted PDF"):
        PDFParser().parse(buf3.getvalue())

    with pytest.raises(ParserError, match="Unable to read PDF"):
        PDFParser().parse(b"not-a-pdf")


def test_chunk_type_is_immutable_enough_for_metadata_use() -> None:
    chunks = chunk_paragraphs("hello", metadata={"k": "v"})
    assert isinstance(chunks[0], Chunk)
    assert chunks[0].metadata["k"] == "v"
