# crystalith-sdk

TypeScript SDK for the Crystalith API, generated from the repo OpenAPI schema.

## Install

```bash
npm install crystalith-sdk
```

## Usage

```ts
import { client, listNotebooksV1NotebooksGet } from 'crystalith-sdk';

client.setConfig({
  baseUrl: 'http://127.0.0.1:8032',
  responseStyle: 'fields',
  throwOnError: true,
});

const res = await listNotebooksV1NotebooksGet<true>();
console.log(res.data);
```

## Generation (repo)

```bash
just api-export
just sdk-gen-typescript
```
