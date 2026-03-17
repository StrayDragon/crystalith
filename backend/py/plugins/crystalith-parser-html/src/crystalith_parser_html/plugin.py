from __future__ import annotations

from crystalith.shared.parsers.html import HTMLParser


class HTMLParserPlugin:
    api_version = "v1"

    parser_type = "html"
    supported_mime_types = HTMLParser.supported_mime_types
    supported_extensions = HTMLParser.supported_extensions

    def create_parser(self, *_args, **_kwargs):
        return HTMLParser()


plugin = HTMLParserPlugin()
