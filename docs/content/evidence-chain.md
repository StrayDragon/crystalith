# Evidence Chain (Citations)

Crystalith treats citations as a first‑class “evidence chain”: QA/chat answers and structured Outputs can include citations that you can inspect, verify in context, and export for sharing.

## Review citations in context

1. Open the citations list:
   - In Chat: under an assistant message, click **View citations**.
   - In Outputs: open an Output and click **View citations**.
2. Click a citation item to open the **Citation Drawer**.
3. In the drawer, you can:
   - **Review context**: see the cited chunk plus a small window of surrounding text.
   - **Locate source**: highlight the source in the Sources panel.
   - **Open source**: open the full Source detail view.

## Export with citations (Markdown / JSON)

Exports include the content plus a citations list and source metadata.

Entry points:
- **Command palette** (`Ctrl+K`): export the current session or the current Output.
- **Header export button**: quick export actions.
- **Chat**: per‑assistant‑message export menu.
- **Outputs**: export menu inside the Output viewer.

Formats:
- **Markdown**: human‑readable body + citations list + sources list.
- **JSON**: structured payload (content + citations + sources) for downstream tooling.

## Common failure states

- **No citations shown**
  - No sources were selected, or the result did not meet the evidence threshold.
- **Context cannot be loaded**
  - Backend is disconnected, or the citation is missing a `chunk_id`.
- **Source cannot be located**
  - The source list is stale, or the underlying source was deleted (the UI will fall back to “Unknown source”).

## API (for integrators)

- Citation context lookup:
  - `GET /v1/notebooks/{notebook_id}/citations/context?chunk_id=...`
- QA export:
  - `GET /v1/notebooks/{notebook_id}/qa/export?session_id=...&format=markdown|json`
- Output export:
  - `GET /v1/notebooks/{notebook_id}/outputs/{output_id}/export?format=markdown|json`

Citation contract: citation objects use `chunk_index` as a 1‑based index within a source.
