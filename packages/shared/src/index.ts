// @crystalith/shared — shared Zod schemas and types for server ↔ frontend.
//
// SSOT for all v2 domain types. Server imports `@crystalith/shared` (or the
// `/schemas` subpath) for request/response validation; the frontend imports
// the same schemas for eden treaty payload typing and runtime guards.
//
// Subpath exports:
//   @crystalith/shared            → this barrel (schemas + inferred types)
//   @crystalith/shared/schemas    → Zod schemas only
//   @crystalith/shared/types      → z.infer<> type aliases
export * from './schemas/index.js';
export * from './types/index.js';
