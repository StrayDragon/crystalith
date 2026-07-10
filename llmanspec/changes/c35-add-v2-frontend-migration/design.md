# Design: Frontend API Migration to Eden Treaty

## Migration Pattern

### Non-streaming calls

```typescript
// Before (generated client):
import { listSourcesV1NotebooksNotebookIdSourcesGet as listSources } from 'api/generated';
const data = await unwrapData(listSources({ path: { notebook_id } }));

// After (eden treaty):
import { api } from 'api/eden';
const { data, error } = await api.v2.notebooks({ nid }).sources.get();
if (error) throw error;
// data is already typed by App
```

### Streaming calls

```typescript
// Before:
const { stream } = await client.sse.post({
  url: '/v1/notebooks/{notebook_id}/qa/stream',
  path: { notebook_id },
  body: { question, session_id },
  onSseEvent: (event) => {
    /* ... */
  },
});
for await (const _event of stream) {
}

// After (direct fetch + SSE parser):
const response = await fetch(`${baseUrl}/v2/qa/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question, notebook_id, session_id }),
});
// Read SSE from response.body ReadableStream manually
```

### Route mapping

| v1 generated path                            | v2 eden path                                                 |
| -------------------------------------------- | ------------------------------------------------------------ |
| `/v1/notebooks`                              | `api.v2.notebooks.get()`                                     |
| `/v1/notebooks/{id}`                         | `api.v2.notebooks({ nid }).get()`                            |
| `/v1/notebooks/{id}/sessions`                | `api.v2.notebooks({ nid }).sessions.get()`                   |
| `/v1/notebooks/{id}/sessions/{sid}/messages` | `api.v2.notebooks({ nid }).sessions({ sid }).messages.get()` |
| `/v1/notebooks/{id}/sources`                 | `api.v2.notebooks({ nid }).sources.get()`                    |
| `/v1/notebooks/{id}/sources/search`          | `api.v2.sources.search.post()`                               |
| `/v1/notebooks/{id}/qa`                      | `api.v2.qa.post()`                                           |
| `/v1/notebooks/{id}/qa/stream`               | `fetch /v2/qa/stream` (SSE)                                  |
| `/v1/notebooks/{id}/research`                | `api.v2.research.get({ query: { notebook_id } })`            |
| `/v1/notebooks/{id}/research/{rid}/stream`   | `fetch /v2/research/{rid}/stream` (SSE)                      |
| `/v1/notebooks/{id}/research/{rid}/approve`  | `api.v2.research({ id: rid }).approve.post()`                |
| `/v1/notebooks/{id}/analysis`                | `api.v2.analysis.post()`                                     |
| `/v1/notebooks/{id}/refine`                  | `api.v2.refine.post()`                                       |
| `/v1/notebooks/{id}/slides/drafts`           | `api.v2.studio.drafts.post()`                                |
| `/v1/notebooks/{id}/outputs`                 | `api.v2.outputs.get()`                                       |
| `/v1/notebooks/{id}/outputs/{type}`          | `api.v2.outputs({ type }).post()`                            |
| `/v1/tasks`                                  | `api.v2.tasks.get()`                                         |
| `/v1/commands`                               | `api.v2.commands.get()`                                      |
| `/v1/models`                                 | `api.v2.models.get()`                                        |
| `/v1/prompt-presets`                         | `api.v2['prompt-presets'].get()`                             |

### Key differences

- v2 uses `:nid`, `:sid`, `:mid` param names (v1 used `notebook_id`, `session_id`, `message_id`)
- v2 QA is at `/v2/qa` (flat), not nested under notebook
- v2 research, outputs, analysis, refine are also flat under `/v2/`
- v2 streams are raw SSE — need manual fetch + ReadableStream consumption

## Implementation Order

Priority order (based on user impact):

1. **chat/QA** (P0) — main interactive feature, streaming + non-streaming
2. **research** (P0) — streaming + CRUD + HITL
3. **sources** (P0) — CRUD + search + upload + tags
4. **outputs** (P1) — create + list + export
5. **tasks** (P1) — list + cancel
6. **analysis** (P1) — notebook analysis
7. **refine** (P1) — batch + single refine
8. **studio** (P1) — slide generation
9. **citations** (P2) — context retrieval
10. **commands** (P2) — list commands
11. **shared/infra** (P2) — evidence export, diagnostics
12. **cleanup** — delete generated client dir
