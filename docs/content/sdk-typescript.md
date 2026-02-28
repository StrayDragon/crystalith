# TypeScript SDK

## Overview
The TypeScript API client is generated from the backend OpenAPI schema and stored in:

- `frontend/web/src/api/generated`

The generated code uses `@hey-api/openapi-ts` + `@hey-api/client-fetch`.

## Versioning / Alignment
- The generated client is tied to the committed `frontend/web/openapi.json`.
- Keep it aligned with the backend by running `just api-sync` (or `pnpm -C frontend/web run api:sync`).

## Local generation (repo)

```bash
# Export latest schema + regenerate TS client
just api-sync

# Or step-by-step
just api-export
just sdk-gen-web
```

## Minimal example (repo code)

```ts
import { client } from '../api/generated/client.gen';
import { unwrapData } from '../api/unwrap';
import {
  createNotebookV1NotebooksPost as createNotebook,
  createOutputV1NotebooksNotebookIdOutputsOutputTypePost as createOutput,
  createSourceFromUrlV1NotebooksNotebookIdSourcesFromUrlPost as createSourceFromUrl,
  listNotebooksV1NotebooksGet as listNotebooks,
  listSourcesV1NotebooksNotebookIdSourcesGet as listSources,
  askQuestionV1NotebooksNotebookIdQaPost as askQuestion,
  listOutputsV1NotebooksNotebookIdOutputsGet as listOutputs,
} from '../api/generated';

client.setConfig({
  baseUrl: 'http://localhost:8000',
  responseStyle: 'fields',
  throwOnError: true,
});

const notebooks = await unwrapData(listNotebooks<true>());
const notebook = await unwrapData(createNotebook<true>({ body: { name: 'Demo' } }));

await unwrapData(createSourceFromUrl<true>({
  path: { notebook_id: notebook.id },
  body: { url: 'https://example.com', mode: 'fetch' },
}));

const sources = await unwrapData(listSources<true>({
  path: { notebook_id: notebook.id },
}));

const qa = await unwrapData(askQuestion<true>({
  path: { notebook_id: notebook.id },
  body: { question: 'Summarize the notebook sources.' },
}));
console.log(qa.answer, qa.citations);

const output = await unwrapData(createOutput<true>({
  path: { notebook_id: notebook.id, output_type: 'BRIEFING' },
  body: {},
}));
console.log(output.id, output.type);

const outputs = await unwrapData(listOutputs<true>({
  path: { notebook_id: notebook.id },
}));
console.log(outputs.map((o) => ({ id: o.id, type: o.type })));
```
