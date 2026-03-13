<!--
AUTO-GENERATED. DO NOT EDIT BY HAND.
Generator: backend/py/scripts/gen_docs.py (run: just gen-docs)
Source: backend/py/src/crystalith/shared/plugins/official_catalog.py
-->
# Official Plugins Catalog (Generated)

This page lists official, optional capability plugins shipped with Crystalith.

Host plugin API version: `v1`

SSOT: `backend/py/src/crystalith/shared/plugins/official_catalog.py`

| Plugin ID | Kind | Package | Install hint |
| --- | --- | --- | --- |
| `connector-local-directory` | `connector` | `crystalith-connector-local-directory` | 安装 crystalith[official-connectors]（推荐）或单独安装 'crystalith-connector-local-directory'，并确保未在 plugins.disabled 中禁用。 |
| `connector-obsidian` | `connector` | `crystalith-connector-obsidian` | 安装 crystalith[official-connectors]（推荐）或单独安装 'crystalith-connector-obsidian'，并确保未在 plugins.disabled 中禁用。 |
| `extractor-browserless` | `extractor` | `crystalith-extractor-browserless` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-extractor-browserless'，并确保未在 plugins.disabled 中禁用。 |
| `extractor-firecrawl` | `extractor` | `crystalith-extractor-firecrawl` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-extractor-firecrawl'，并确保未在 plugins.disabled 中禁用。 |
| `extractor-jina` | `extractor` | `crystalith-extractor-jina` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-extractor-jina'，并确保未在 plugins.disabled 中禁用。 |
| `extractor-trafilatura` | `extractor` | `crystalith-extractor-trafilatura` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-extractor-trafilatura'，并确保未在 plugins.disabled 中禁用。 |
| `output-briefing` | `output` | `crystalith-output-briefing` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-briefing'，并确保未在 plugins.disabled 中禁用。 |
| `output-faq` | `output` | `crystalith-output-faq` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-faq'，并确保未在 plugins.disabled 中禁用。 |
| `output-guide` | `output` | `crystalith-output-guide` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-guide'，并确保未在 plugins.disabled 中禁用。 |
| `output-mindmap` | `output` | `crystalith-output-mindmap` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-mindmap'，并确保未在 plugins.disabled 中禁用。 |
| `output-quiz` | `output` | `crystalith-output-quiz` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-quiz'，并确保未在 plugins.disabled 中禁用。 |
| `output-timeline` | `output` | `crystalith-output-timeline` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-output-timeline'，并确保未在 plugins.disabled 中禁用。 |
| `parser-html` | `parser` | `crystalith-parser-html` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-parser-html'，并确保未在 plugins.disabled 中禁用。 |
| `parser-media` | `parser` | `crystalith-parser-media` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-parser-media'，并确保未在 plugins.disabled 中禁用。 |
| `parser-pdf` | `parser` | `crystalith-parser-pdf` | 安装 crystalith[official-full]（推荐）或单独安装 'crystalith-parser-pdf'，并确保未在 plugins.disabled 中禁用。 |
| `slides-slidev` | `slides` | `crystalith-slides-slidev` | 安装 crystalith[official-slides]（推荐）或单独安装 'crystalith-slides-slidev'，并确保未在 plugins.disabled 中禁用。 |

Enable/disable via `config/app.yaml`:

```yaml
plugins:
  enabled: ["output-faq", "parser-pdf"]  # allowlist (optional)
  disabled: ["extractor-jina"]           # denylist (always applied)
```
