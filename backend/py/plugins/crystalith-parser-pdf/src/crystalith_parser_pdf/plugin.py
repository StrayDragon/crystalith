from __future__ import annotations

from crystalith.shared.parsers.pdf import PDFParser


class PDFParserPlugin:
    api_version = "v1"

    parser_type = "pdf"
    supported_mime_types = PDFParser.supported_mime_types
    supported_extensions = PDFParser.supported_extensions

    def create_parser(self, *_args, **_kwargs):
        return PDFParser()


plugin = PDFParserPlugin()
