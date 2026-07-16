// @crystalith/gen-app-schema
// Generate config/app.schema.gen.json from the combined RootConfigSchema.
//
// Usage:
//   bun scripts/gen-app-schema.ts           # generate config/app.schema.gen.json
//   bun scripts/gen-app-schema.ts --check   # check for drift (exit 1 if different)
//
// The SSOT is RootConfigSchema in apps/server/src/shared/config.ts — a single
// Zod object combining all app.yaml sections with inline .describe() calls.
// NEVER edit app.schema.gen.json or SECTION_MAPPINGS manually.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { RootConfigSchema } from '../apps/server/src/shared/config.ts';

// ---------------------------------------------------------------------------
// Custom Zod → JSON Schema converter (Zod v4 compatible)
//
// Zod v4 stores:
//   - type as schema.type (direct property): "default" | "number" | "string" | "boolean" | "object" | ...
//   - description as schema.description (direct property, set via .describe())
//   - default value in .unwrap() or .removeDefault()
//   - object shape in schema._def.shape
// ---------------------------------------------------------------------------

/** Get the innermost type name by unwrapping wrapper layers. */
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
    case 'record': {
      result.type = 'object';
      const def = innerDef(field);
      const valueType = def.valueType as Record<string, unknown> | undefined;
      if (valueType) {
        result.additionalProperties = zodToJson(valueType);
      }
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
// Assembler — walks RootConfigSchema.shape instead of a manual mapping
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

function assembleSchema(): JsonSchemaRoot {
  const shape = (RootConfigSchema as unknown as Record<string, unknown>)._def?.shape as
    | Record<string, unknown>
    | undefined;
  if (!shape) {
    throw new Error('Cannot read RootConfigSchema shape');
  }

  const properties: Record<string, unknown> = {};
  for (const [yamlKey, sectionSchema] of Object.entries(shape)) {
    properties[yamlKey] = zodToJson(sectionSchema as Record<string, unknown>);
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
  const root = assembleSchema();
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
