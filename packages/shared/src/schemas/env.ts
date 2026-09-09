// @crystalith/shared — Environment variable schema SSOT.
//
// Single source of truth for all environment variables used by Crystalith v2.
// The gen-env-examples.ts script consumes this to auto-generate:
//   - .env.example              (all CL_* keys → .env file)
//
// When adding a new env var:
//   1. Add it here with .describe() and an appropriate default
//   2. Run `just gen-env-examples` to regenerate .example files
//   3. Run `just gen-app-schema` to regenerate JSON Schema if config is affected
//
// NEVER edit .example files manually — they are generated artifacts.

import { z } from 'zod';

import './zod-extend.js';
import { desc } from './i18n.js';

// ---------------------------------------------------------------------------
// Target file classification
// ---------------------------------------------------------------------------

/**
 * Target file for each env var group.
 * - `build-run`: all CL_* parameters incl. API keys → `.env` (keys also via shell export)
 */
export const EnvTarget = {
  BuildRun: 'build-run',
} as const;
export type EnvTarget = (typeof EnvTarget)[keyof typeof EnvTarget];

// ---------------------------------------------------------------------------
// Build-run env vars (→ .env)
// Non-secret parameters controlling server, build, and runtime behavior.
// API keys live here too: set them via shell export or a gitignored `.env`.
// ---------------------------------------------------------------------------

export const BuildRunEnvSchema = z
  .object({
    // --- Server ---
    CL_SERVER_PORT: z.coerce.number().default(8032).describe(desc('env.CL_SERVER_PORT')),

    CL_SERVER_HOST: z.string().default('127.0.0.1').describe(desc('env.CL_SERVER_HOST')),

    // --- Paths ---
    CL_DATA_ROOT: z.string().default('./data').describe(desc('env.CL_DATA_ROOT')),

    CL_DB_PATH: z.string().default('').describe(desc('env.CL_DB_PATH')),

    CL_CONFIG_PATH: z.string().default('config/app.yaml').describe(desc('env.CL_CONFIG_PATH')),

    // --- API endpoints ---
    CL_CHAT_API_BASE: z.string().default('').describe(desc('env.CL_CHAT_API_BASE')),

    CL_EMBEDDING_API_BASE: z.string().default('').describe(desc('env.CL_EMBEDDING_API_BASE')),

    OPENAI_BASE_URL: z.string().default('').describe(desc('env.OPENAI_BASE_URL')),

    // --- API keys ---
    CL_CHAT_API_KEY: z.string().default('').describe(desc('env.CL_CHAT_API_KEY')),

    CL_EMBEDDING_API_KEY: z.string().default('').describe(desc('env.CL_EMBEDDING_API_KEY')),

    CL_JINA_API_KEY: z.string().default('').describe(desc('env.CL_JINA_API_KEY')),

    CL_FIRECRAWL_API_KEY: z.string().default('').describe(desc('env.CL_FIRECRAWL_API_KEY')),

    CRYSTALITH_API_KEY: z.string().default('').describe(desc('env.CRYSTALITH_API_KEY')),

    OPENAI_API_KEY: z.string().default('').describe(desc('env.OPENAI_API_KEY')),

    ANTHROPIC_API_KEY: z.string().default('').describe(desc('env.ANTHROPIC_API_KEY')),

    GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .default('')
      .describe(desc('env.GOOGLE_GENERATIVE_AI_API_KEY')),

    // --- Model overrides ---
    CL_DEFAULT_CHAT_MODEL: z.string().default('').describe(desc('env.CL_DEFAULT_CHAT_MODEL')),

    CL_DEFAULT_EMBEDDING_MODEL: z
      .string()
      .default('')
      .describe(desc('env.CL_DEFAULT_EMBEDDING_MODEL')),

    CL_CHAT_MODEL: z.string().default('').describe(desc('env.CL_CHAT_MODEL')),

    CL_CHAT_LIGHT_MODEL: z.string().default('').describe(desc('env.CL_CHAT_LIGHT_MODEL')),

    CL_EMBEDDING_MODEL: z.string().default('').describe(desc('env.CL_EMBEDDING_MODEL')),

    // --- Search ---
    CL_SEARXNG_HOST: z.string().default('').describe(desc('env.CL_SEARXNG_HOST')),

    // --- Slides preview (Slidev) availability probe ---
    CL_SLIDEV_BASE_URL: z.string().default('').describe(desc('env.CL_SLIDEV_BASE_URL')),

    // --- Outbound proxy ---
    CL_PROXY_ENABLED: z.string().default('').describe(desc('env.CL_PROXY_ENABLED')),

    CL_PROXY_HTTP_URL: z.string().default('').describe(desc('env.CL_PROXY_HTTP_URL')),

    CL_PROXY_HTTPS_URL: z.string().default('').describe(desc('env.CL_PROXY_HTTPS_URL')),

    // --- Observability ---
    CL_LOG_LEVEL: z
      .enum(['debug', 'info', 'warn', 'error'])
      .default('info')
      .describe(desc('env.CL_LOG_LEVEL')),

    // --- Web extraction ---
    CL_FIRECRAWL_API_BASE: z.string().default('').describe(desc('env.CL_FIRECRAWL_API_BASE')),

    // --- Frontend ---
    VITE_API_PROXY_TARGET: z
      .string()
      .default('http://127.0.0.1:8032')
      .describe(desc('env.VITE_API_PROXY_TARGET')),
    VITE_LAB_DEMO: z.string().default('').describe(desc('env.VITE_LAB_DEMO')),
    /** @deprecated Ignored for product `/research-lab`; use `/demo/research-lab` + VITE_LAB_DEMO. */
    VITE_LAB_FIXTURE: z.string().default('').describe(desc('env.VITE_LAB_FIXTURE')),
  })
  .openapi({
    description: desc('env.build_run', '构建/运行环境变量（→ .env）'),
  });

export type BuildRunEnv = z.infer<typeof BuildRunEnvSchema>;

// ---------------------------------------------------------------------------
// Deprecated / backward-compat env vars (→ .env)
// Pre-v2 env vars kept for backward compatibility. New code MUST use CL_*
// variants. Listed at the bottom of .env.example under "# --- Deprecated ---".
// ---------------------------------------------------------------------------

export const DeprecatedEnvSchema = z
  .object({
    CL_SECRET_PATH: z.string().default('').describe(desc('env.CL_SECRET_PATH')),

    SEARXNG_HOST: z.string().default('').describe(desc('env.SEARXNG_HOST')),

    JINA_API_KEY: z.string().default('').describe(desc('env.JINA_API_KEY')),

    FIRECRAWL_API_KEY: z.string().default('').describe(desc('env.FIRECRAWL_API_KEY')),
  })
  .openapi({
    description: desc('env.deprecated', '已弃用环境变量（兼容保留）'),
  });

export type DeprecatedEnv = z.infer<typeof DeprecatedEnvSchema>;

// ---------------------------------------------------------------------------
// Composite schema (combined for validation or bulk operations)
// ---------------------------------------------------------------------------

/**
 * All env vars merged into one flat schema.
 * Useful for runtime validation of the full environment.
 */
export const AllEnvSchema = BuildRunEnvSchema.extend(DeprecatedEnvSchema.shape);
export type AllEnv = z.infer<typeof AllEnvSchema>;

// ---------------------------------------------------------------------------
// Metadata for generator scripts
// ---------------------------------------------------------------------------

/**
 * Entry descriptor used by gen-env-examples.ts to produce .example files.
 */
export interface EnvEntryDescriptor {
  key: string;
  description: string;
  target: EnvTarget;
  default: string;
  deprecated?: boolean;
}

/**
 * Extract typed descriptors from a Zod schema for auto-generation.
 */
function extractDescriptors(
  schema: z.ZodObject<z.ZodRawShape>,
  target: EnvTarget,
  deprecated?: boolean,
): EnvEntryDescriptor[] {
  const shape = schema.shape;
  return Object.entries(shape).map(([key, field]) => {
    const description =
      field &&
      typeof field === 'object' &&
      'description' in field &&
      typeof field.description === 'string'
        ? field.description
        : '';
    return {
      key,
      description,
      target,
      default: '',
      deprecated,
    };
  });
}

/**
 * Complete list of all env var descriptors, ordered: build-run → deprecated.
 * Consumed by gen-env-examples.ts.
 */
export function getAllEnvDescriptors(): EnvEntryDescriptor[] {
  return [
    ...extractDescriptors(BuildRunEnvSchema, EnvTarget.BuildRun),
    ...extractDescriptors(DeprecatedEnvSchema, EnvTarget.BuildRun, true),
  ];
}
