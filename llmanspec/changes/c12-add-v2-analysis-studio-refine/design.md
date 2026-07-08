## Approach

Unifying three v1 features into a single change workspace.

### 1. Analysis (`features/analysis/`)

- **POST /v2/analysis** → cluster topics + detect contradictions + correlation
- v1 uses KMeans-like clustering on vector distances; v2 can use LLM-powered analysis
- Output: `AnalysisResult { topics, relations, contradictions }` (see Phase 1 shared schemas)

### 2. Studio / Slides (`features/studio/`)

- **POST /v2/studio/slides** → retrieve context → generate Slidev markdown via streamText
- Configurable: theme, audience, structure, tone, language, density
- v1 `features/studio/slides/generator.py` reference

### 3. Refine (`features/refine/`)

- **POST /v2/refine** → 4 modes via system prompt:
  - `expand` — elaborate/expand
  - `summarize` — condense/shorten
  - `rewrite` — rephrase/improve
  - `translate` — translate to another language

### 4. Templates & Prompt Presets (`features/templates/`)

- CRUD for Nunjucks templates (used by slides generation)
- CRUD for prompt presets (/prompt:xxx pattern, integrated with QA in Phase 5)

### 5. Background Tasks (`features/tasks/`)

- Simple in-process task queue for long-running operations (research, slides generation)
- Unified lifecycle: pending → running → completed | failed | cancelled
- GET /v2/tasks/:id for progress polling

### Dependencies

Leverages Phase 2 AI Runtime (streamText, generateObject) and Phase 5 RAG (retrieve context).
