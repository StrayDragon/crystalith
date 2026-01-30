# Proposal: Simplify frontend API client usage

## Context
The frontend currently wraps the OpenAPI-generated client in `frontend/web/src/api/client.ts`. That wrapper:
- Re-exports types for convenience.
- Normalizes errors into a custom `ApiError`.
- Implements several endpoints via manual `fetch` (e.g., source-from-URL, extractors, SSE QA stream, conversions), because they are not available in the generated SDK.

While convenient, this wrapper creates ongoing maintenance cost whenever the API surface changes. The user asked to evaluate using the generated client (`frontend/web/src/api/generated/client.gen.ts`) directly and reduce the wrapper overhead.

## Goals
- Reduce frontend maintenance cost by using the generated client for most API calls.
- Keep a minimal, well-scoped layer only where the generated client cannot be used (e.g., SSE stream, missing OpenAPI endpoints).
- Preserve current runtime behavior and error messaging unless explicitly changed.

## Non-Goals
- No backend feature changes beyond updating OpenAPI coverage when necessary.
- No UX/behavior changes to existing workflows.
- No generator replacement or build system overhaul.

## Success Criteria
- The majority of frontend API calls import generated functions directly.
- Any manual fetch calls are consolidated into a small, documented module.
- Error handling is consistent and traceable across generated + manual calls.

## Open Questions
- Should we add the missing endpoints to OpenAPI so they can be generated, or keep a small manual module for them?
- Should error handling remain centralized (custom `ApiError`) or follow generated client error shapes?
- Do we want to codify a pattern for SSE/streaming endpoints in the generated client usage?
