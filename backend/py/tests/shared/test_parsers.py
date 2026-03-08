from __future__ import annotations

from io import BytesIO

import pytest
from pypdf import PdfWriter

from tests._support.settings import make_settings
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


def test_markdown_parser_normalizes_obsidian_wikilinks_and_embeds() -> None:
    parser = ParserFactory.from_file(filename="vault/daily-note.md", mime_type="text/markdown")
    chunks = parser.parse(
        b"---\ntitle: Daily Note\ntags:\n  - inbox\n---\n\n"
        b"Link [[Project Plan|the plan]] and ![[diagram.png]] here.\n\n"
        b"Second paragraph with [[Roadmap]]."
    )

    assert [chunk.text for chunk in chunks] == [
        "Link [the plan](Project Plan.md) and [嵌入: diagram.png] here.",
        "Second paragraph with [Roadmap](Roadmap.md).",
    ]


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
        def __init__(self, response: object) -> None:
            self._response = response

        def create(self, *, model: str, file: object) -> object:  # noqa: ARG002
            return self._response

    class _Audio:
        def __init__(self, response: object) -> None:
            self._transcriptions = _AudioTranscriptions(response)

        @property
        def transcriptions(self) -> _AudioTranscriptions:
            return self._transcriptions

    class _Client:
        def __init__(self, response: object) -> None:
            self._audio = _Audio(response)

        @property
        def audio(self) -> _Audio:
            return self._audio

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

    class _BoomAudioTranscriptions:
        def create(self, *, model: str, file: object) -> object:  # noqa: ARG002
            raise RuntimeError("boom")

    class _BoomAudio:
        def __init__(self) -> None:
            self._transcriptions = _BoomAudioTranscriptions()

        @property
        def transcriptions(self) -> _BoomAudioTranscriptions:
            return self._transcriptions

    class _BoomClient:
        def __init__(self) -> None:
            self._audio = _BoomAudio()

        @property
        def audio(self) -> _BoomAudio:
            return self._audio

    boom = OpenAITranscriber(model="whisper-1", client=_BoomClient())
    with pytest.raises(ParserError, match="OpenAI transcription failed"):
        boom.transcribe(b"data")


def test_create_transcription_provider_returns_disabled_when_no_openai_model() -> None:
    settings = make_settings({"models": {"available": []}})
    provider = create_transcription_provider(settings)
    assert isinstance(provider, DisabledTranscriber)


def test_create_transcription_provider_returns_disabled_when_api_key_missing() -> None:
    settings = make_settings(
        {
            "models": {
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
        }
    )
    provider = create_transcription_provider(settings)
    assert isinstance(provider, DisabledTranscriber)


def test_create_transcription_provider_returns_openai_transcriber_when_key_present() -> None:
    settings = make_settings(
        {
            "models": {
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
        }
    )
    provider = create_transcription_provider(settings)
    assert isinstance(provider, OpenAITranscriber)
    assert provider.provider == "openai"


def test_parser_factory_selects_youtube_video_parser_and_plugins() -> None:
    assert _is_youtube_url("https://youtu.be/abc") is True
    assert _is_youtube_url("ftp://youtu.be/abc") is False

    registry = PluginRegistry()

    class _CustomPlugin:
        api_version = "v1"
        parser_type = "custom"
        supported_mime_types = {"application/x-custom"}
        supported_extensions = {".cstm"}

        def create_parser(self, *, filename, mime_type, transcriber=None, media_fetcher=None):  # noqa: ANN001
            return TextParser()

    custom_plugin_id = "parser-custom"
    custom = _CustomPlugin()
    registry.parsers[custom.parser_type] = custom
    registry.plugins[custom_plugin_id] = custom
    registry._parser_plugin_ids[custom.parser_type] = custom_plugin_id  # noqa: SLF001
    registry._load_report.loaded.append(custom_plugin_id)  # noqa: SLF001

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

    with pytest.raises(UnsupportedDocumentError) as exc_info:
        ParserFactory.from_file(
            filename="https://youtu.be/abc",
            mime_type=None,
            media_fetcher=_Fetcher(),
            transcriber=_Transcriber(),
        )
    assert exc_info.value.required_plugin_id == "parser-media"

    class _MediaPlugin:
        api_version = "v1"
        parser_type = "media"
        supported_mime_types = {"video/mp4"}
        supported_extensions: set[str] = set()

        def create_parser(self, *, filename, mime_type, transcriber=None, media_fetcher=None):  # noqa: ANN001
            return VideoParser(
                transcriber,
                filename=filename,
                mime_type=mime_type,
                source_url=filename,
                media_fetcher=media_fetcher,
            )

    media_plugin_id = "parser-media"
    media = _MediaPlugin()
    registry.parsers[media.parser_type] = media
    registry.plugins[media_plugin_id] = media
    registry._parser_plugin_ids[media.parser_type] = media_plugin_id  # noqa: SLF001
    registry._load_report.loaded.append(media_plugin_id)  # noqa: SLF001

    youtube_resolution = ParserFactory.resolve_from_file(
        filename="https://youtu.be/abc",
        mime_type=None,
        media_fetcher=_Fetcher(),
        transcriber=_Transcriber(),
        plugins=registry,
    )
    assert youtube_resolution.parser_plugin_id == "parser-media"
    assert isinstance(youtube_resolution.parser, VideoParser)
    assert youtube_resolution.parser.parse(b"ignored")[0].text == "ok"


def test_parser_factory_selects_parsers_by_mime_and_extension() -> None:
    assert isinstance(ParserFactory.from_file(filename="a.txt", mime_type="text/plain"), TextParser)
    assert isinstance(ParserFactory.from_file(filename="a.csv", mime_type="text/csv"), CSVParser)
    assert isinstance(ParserFactory.from_file(filename="a.csv", mime_type=None), CSVParser)

    with pytest.raises(UnsupportedDocumentError) as html_exc:
        ParserFactory.from_file(filename="a.html", mime_type="text/html")
    assert html_exc.value.required_plugin_id == "parser-html"

    with pytest.raises(UnsupportedDocumentError) as pdf_exc:
        ParserFactory.from_file(filename="a.pdf", mime_type="application/pdf")
    assert pdf_exc.value.required_plugin_id == "parser-pdf"

    class _Transcriber:
        provider = "test"
        model = "test"

        def transcribe(self, content: bytes, *, filename: str | None = None, mime_type: str | None = None) -> str:
            return "ok"

    with pytest.raises(UnsupportedDocumentError) as audio_exc:
        ParserFactory.from_file(filename="a.mp3", mime_type=None, transcriber=_Transcriber())
    assert audio_exc.value.required_plugin_id == "parser-media"

    class _HTMLPlugin:
        api_version = "v1"
        parser_type = "html"
        supported_mime_types = {"text/html"}
        supported_extensions = {".html", ".htm"}

        def create_parser(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            return HTMLParser()

    class _PDFPlugin:
        api_version = "v1"
        parser_type = "pdf"
        supported_mime_types = {"application/pdf"}
        supported_extensions = {".pdf"}

        def create_parser(self, *_args, **_kwargs):  # noqa: ANN002, ANN003
            return PDFParser()

    class _MediaPlugin:
        api_version = "v1"
        parser_type = "media"
        supported_mime_types = {"audio/mpeg", "video/mp4"}
        supported_extensions = {".mp3", ".mp4"}

        def create_parser(self, *, filename, mime_type, transcriber=None, media_fetcher=None):  # noqa: ANN001
            if (filename or "").lower().endswith(".mp3") or (mime_type or "").startswith("audio/"):
                return AudioParser(transcriber, filename=filename, mime_type=mime_type)
            return VideoParser(
                transcriber,
                filename=filename,
                mime_type=mime_type,
                source_url=filename if _is_youtube_url(filename or "") else None,
                media_fetcher=media_fetcher,
            )

    registry = PluginRegistry()
    for plugin_id, plugin in [
        ("parser-html", _HTMLPlugin()),
        ("parser-pdf", _PDFPlugin()),
        ("parser-media", _MediaPlugin()),
    ]:
        registry.parsers[plugin.parser_type] = plugin
        registry.plugins[plugin_id] = plugin
        registry._parser_plugin_ids[plugin.parser_type] = plugin_id  # noqa: SLF001
        registry._load_report.loaded.append(plugin_id)  # noqa: SLF001

    assert isinstance(
        ParserFactory.from_file(filename="a.html", mime_type="text/html", plugins=registry),
        HTMLParser,
    )
    assert isinstance(
        ParserFactory.from_file(filename="a.pdf", mime_type="application/pdf", plugins=registry),
        PDFParser,
    )
    assert isinstance(
        ParserFactory.from_file(filename="a.mp3", mime_type=None, transcriber=_Transcriber(), plugins=registry),
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
