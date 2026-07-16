// @crystalith/gen-app-schema
// Generate config/app.schema.gen.json from Zod schemas in config.ts.
//
// Uses a custom lightweight Zod → JSON Schema converter (Zod v4 compatible).
//
// Usage:
//   bun scripts/gen-app-schema.ts           # generate config/app.schema.gen.json
//   bun scripts/gen-app-schema.ts --check   # check for drift (exit 1 if different)
//
// The SSOT Zod schemas live in apps/server/src/shared/config.ts.
// NEVER edit app.schema.gen.json manually — edit the Zod schemas and regenerate.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import {
  AiSettingsSchema,
  AppSettingsSchema,
  CompletionOptionsSchema,
  ConcurrencySettingsSchema,
  ContextWindowSettingsSchema,
  EmbeddingSettingsSchema,
  OptionalServicesSchema,
  SearchSettingsSchema,
  StorageSettingsSchema,
  SsrfPolicyConfigSchema,
} from '../apps/server/src/shared/config.ts';

// ---------------------------------------------------------------------------
// Custom Zod → JSON Schema converter (Zod v4 compatible)
//
// Zod v4 stores:
//   - type as schema.type (direct property): "default" | "number" | "string" | "boolean" | "object" | ...
//   - description as schema.description (direct property, set via .describe())
//   - default value in .unwrap() or .removeDefault()
//   - object shape in schema._def.shape
// ---------------------------------------------------------------------------

/** Get the innermost type name by unwrapping "default" and "optional" layers. */
function innerTypeName(field: Record<string, unknown>): string {
  let current = field;
  for (let i = 0; i < 10; i++) {
    const t = current.type as string;
    if (t !== 'default' && t !== 'optional' && t !== 'nullable') return t;
    const next =
      ((current._def as Record<string, unknown>)?.innerType as
        | Record<string, unknown>
        | undefined) ?? (current.innerType as Record<string, unknown> | undefined);
    if (!next) return t;
    current = next;
  }
  return (current.type as string) ?? 'unknown';
}

/** Get the innermost description by walking through wrapper layers. */
function innerDescription(field: Record<string, unknown>): string {
  if (field.description && typeof field.description === 'string' && field.description.length > 0) {
    return field.description as string;
  }
  // Try to unwrap default/optional/nullable
  const inner = (field._def as Record<string, unknown>)?.innerType as
    | Record<string, unknown>
    | undefined;
  if (inner && inner !== field) {
    return innerDescription(inner);
  }
  return '';
}

/** Extract default value from a "default" wrapper. */
function extractDefault(field: Record<string, unknown>): unknown {
  if (field.type === 'default') {
    const def = field._def as Record<string, unknown> | undefined;
    const dv = def?.defaultValue;
    if (dv !== undefined) return dv;
  }
  return undefined;
}

/** Get the innermost _def by unwrapping wrapper layers. */
function innerDef(field: Record<string, unknown>): Record<string, unknown> {
  let current = field;
  for (let i = 0; i < 10; i++) {
    const t = current.type as string;
    if (t !== 'default' && t !== 'optional' && t !== 'nullable') {
      return (current._def as Record<string, unknown>) ?? {};
    }
    const next =
      ((current._def as Record<string, unknown>)?.innerType as
        | Record<string, unknown>
        | undefined) ?? (current.innerType as Record<string, unknown> | undefined);
    if (!next || next === current) {
      return (current._def as Record<string, unknown>) ?? {};
    }
    current = next;
  }
  return (current._def as Record<string, unknown>) ?? {};
}

/** Recursively convert a Zod v4 field to JSON Schema. */
function zodToJson(field: Record<string, unknown>): Record<string, unknown> {
  const typeName = innerTypeName(field);
  const description = innerDescription(field) || (field.description as string) || '';
  const defaultValue = extractDefault(field);

  const result: Record<string, unknown> = {};

  if (description) {
    result.description = description;
  }
  if (defaultValue !== undefined) {
    result.default = defaultValue;
  }

  switch (typeName) {
    case 'object': {
      result.type = 'object';
      const def = innerDef(field);
      const shape = def.shape as Record<string, unknown> | undefined;
      if (shape) {
        const properties: Record<string, unknown> = {};
        for (const [key, subField] of Object.entries(shape)) {
          properties[key] = zodToJson(subField as Record<string, unknown>);
        }
        result.properties = properties;
      }
      break;
    }
    case 'string': {
      result.type = 'string';
      break;
    }
    case 'number': {
      result.type = 'number';
      break;
    }
    case 'boolean': {
      result.type = 'boolean';
      break;
    }
    case 'array': {
      result.type = 'array';
      const def = innerDef(field);
      const elementType = (def.element ?? def.type) as Record<string, unknown> | undefined;
      if (elementType && elementType !== field) {
        result.items = zodToJson(elementType);
      } else {
        result.items = {};
      }
      break;
    }
    case 'enum': {
      result.type = 'string';
      // Zod v4 stores enum entries in def.entries as {key: key} object
      const def = innerDef(field);
      const entriesObj = def.entries as Record<string, string> | undefined;
      const entries = entriesObj ? Object.keys(entriesObj) : [];
      if (entries.length > 0) {
        result.enum = entries;
      }
      break;
    }
    default: {
      // Fallback: try object detection via shape
      const def = innerDef(field);
      if (def.shape) {
        result.type = 'object';
        const shape = def.shape as Record<string, unknown>;
        const properties: Record<string, unknown> = {};
        for (const [key, subField] of Object.entries(shape)) {
          properties[key] = zodToJson(subField as Record<string, unknown>);
        }
        result.properties = properties;
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Schema mapping
// ---------------------------------------------------------------------------

interface SectionMapping {
  yamlKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  description: string;
}

const SECTION_MAPPINGS: SectionMapping[] = [
  {
    yamlKey: 'app',
    schema: AppSettingsSchema,
    description: '应用层设置：CORS、auth、startup behavior、feature flags',
  },
  {
    yamlKey: 'ai',
    schema: AiSettingsSchema,
    description: 'AI 运行时设置：超时、重试次数',
  },
  {
    yamlKey: 'completion_options',
    schema: CompletionOptionsSchema,
    description: 'Completion 参数默认值：temperature、top_p、stop 序列等',
  },
  {
    yamlKey: 'concurrency',
    schema: ConcurrencySettingsSchema,
    description: '并发控制门禁：embedding、vector_search、llm_generate 的并发数限制',
  },
  {
    yamlKey: 'embedding',
    schema: EmbeddingSettingsSchema,
    description: '文本嵌入设置：chunk_size、batch_size',
  },
  {
    yamlKey: 'context_window',
    schema: ContextWindowSettingsSchema,
    description: '上下文窗口设置：max_tokens、compression_strategy、window_size',
  },
  {
    yamlKey: 'search',
    schema: SearchSettingsSchema,
    description: '搜索引擎设置：SearXNG 实例地址、超时、最大结果数',
  },
  {
    yamlKey: 'optional_services',
    schema: OptionalServicesSchema,
    description: '可选服务配置：Chroma、SearXNG、Redis 的启用状态与接入点',
  },
  {
    yamlKey: 'storage',
    schema: StorageSettingsSchema,
    description: '存储设置：数据根目录路径',
  },
  {
    yamlKey: 'source_ingestion',
    schema: SsrfPolicyConfigSchema,
    description: '来源摄取安全策略：SSRF 白名单域名/IP、重定向限制',
  },
];

// ---------------------------------------------------------------------------
// Assembler
// ---------------------------------------------------------------------------

interface JsonSchemaRoot {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  type: 'object';
  properties: Record<string, unknown>;
  additionalProperties?: boolean;
}

function assembleSchema(mappings: SectionMapping[]): JsonSchemaRoot {
  const properties: Record<string, unknown> = {};

  for (const { yamlKey, schema, description } of mappings) {
    const jsonSchema = zodToJson(schema as Record<string, unknown>);
    properties[yamlKey] = {
      ...jsonSchema,
      description,
    };
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: './app.schema.gen.json',
    title: 'Crystalith v2 Configuration Schema',
    description:
      'Auto-generated JSON Schema for config/app.yaml. DO NOT EDIT MANUALLY — update Zod schemas in apps/server/src/shared/config.ts and run `just gen-app-schema`.',
    type: 'object',
    properties,
    additionalProperties: true,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SCHEMA_FILE = join(process.cwd(), 'config', 'app.schema.gen.json');

function main(): void {
  const isCheck = process.argv.includes('--check');
  const root = assembleSchema(SECTION_MAPPINGS);
  const content = JSON.stringify(root, null, 2) + '\n';

  if (isCheck) {
    if (existsSync(SCHEMA_FILE)) {
      const existing = readFileSync(SCHEMA_FILE, 'utf-8');
      if (existing !== content) {
        console.error(
          '[check] config/app.schema.gen.json differs from SSOT — run `just gen-app-schema` to regenerate',
        );
        process.exit(1);
      }
      console.log('[check] config/app.schema.gen.json is up to date.');
    } else {
      console.error(
        '[check] config/app.schema.gen.json is MISSING — run `just gen-app-schema` to create it',
      );
      process.exit(1);
    }
    return;
  }

  mkdirSync(dirname(SCHEMA_FILE), { recursive: true });
  writeFileSync(SCHEMA_FILE, content, 'utf-8');
  console.log(`[gen] Wrote ${SCHEMA_FILE}`);
}

main();
