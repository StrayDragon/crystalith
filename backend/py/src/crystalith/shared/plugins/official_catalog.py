from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


OfficialPluginKind = Literal["output", "parser", "extractor"]


@dataclass(frozen=True, slots=True)
class OfficialPluginCatalogEntry:
    plugin_id: str
    kind: OfficialPluginKind
    package: str

    def default_install_hint(self) -> str:
        return f"安装 crystalith[official-full]（推荐）或单独安装 {self.package!r}，并确保未在 plugins.disabled 中禁用。"


OFFICIAL_PLUGIN_CATALOG: dict[str, OfficialPluginCatalogEntry] = {
    # Output type plugins
    "output-faq": OfficialPluginCatalogEntry(plugin_id="output-faq", kind="output", package="crystalith-output-faq"),
    "output-guide": OfficialPluginCatalogEntry(plugin_id="output-guide", kind="output", package="crystalith-output-guide"),
    "output-timeline": OfficialPluginCatalogEntry(plugin_id="output-timeline", kind="output", package="crystalith-output-timeline"),
    "output-mindmap": OfficialPluginCatalogEntry(plugin_id="output-mindmap", kind="output", package="crystalith-output-mindmap"),
    "output-quiz": OfficialPluginCatalogEntry(plugin_id="output-quiz", kind="output", package="crystalith-output-quiz"),
    "output-briefing": OfficialPluginCatalogEntry(plugin_id="output-briefing", kind="output", package="crystalith-output-briefing"),
    # Parser plugins
    "parser-pdf": OfficialPluginCatalogEntry(plugin_id="parser-pdf", kind="parser", package="crystalith-parser-pdf"),
    "parser-html": OfficialPluginCatalogEntry(plugin_id="parser-html", kind="parser", package="crystalith-parser-html"),
    "parser-media": OfficialPluginCatalogEntry(plugin_id="parser-media", kind="parser", package="crystalith-parser-media"),
    # Web extractor plugins
    "extractor-trafilatura": OfficialPluginCatalogEntry(
        plugin_id="extractor-trafilatura",
        kind="extractor",
        package="crystalith-extractor-trafilatura",
    ),
    "extractor-jina": OfficialPluginCatalogEntry(plugin_id="extractor-jina", kind="extractor", package="crystalith-extractor-jina"),
    "extractor-firecrawl": OfficialPluginCatalogEntry(
        plugin_id="extractor-firecrawl",
        kind="extractor",
        package="crystalith-extractor-firecrawl",
    ),
    "extractor-browserless": OfficialPluginCatalogEntry(
        plugin_id="extractor-browserless",
        kind="extractor",
        package="crystalith-extractor-browserless",
    ),
}

