// @crystalith/shared/types — z.infer<> type aliases.
//
// Re-exports only the TypeScript types (no runtime schema validators) so
// consumers can `import type { Notebook, Message, OutputType } from
// '@crystalith/shared/types'` without bundling Zod.
//
// `export type *` mirrors every `export type X = z.infer<...>` declared in the
// schemas barrel — keeping this file drift-free as schemas evolve.
export type * from '../schemas/index.js';
