// OpenAPI 3.1 document generation from shared Zod schemas (c71).
//
// History: `@asteasolutions/zod-to-openapi` OpenApiGeneratorV31 + Zod v4 hits
// Maximum call stack in `isNullableSchema` (safeParse recursion) on our
// full route set. We still use `extendZodWithOpenApi` for `.openapi()` metadata
// on schemas, but convert Zod → JSON Schema with Zod's native `z.toJSONSchema`
// and assemble the OpenAPI document ourselves.
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const _allTags = new Set<string>();

/** Accumulated path operations for document assembly (c71). */
const _pathOps: Array<{
  path: string;
  method: OpenApiRoute['method'];
  operation: Record<string, unknown>;
}> = [];

export interface OpenApiRoute {
  path: string;
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  summary?: string;
  description?: string;
  tags?: string[];
  /** When true, marks the OpenAPI operation as deprecated (flat aliases in c69). */
  deprecated?: boolean;
  request?: {
    body?: z.ZodType;
    params?: Record<string, z.ZodType>;
    query?: Record<string, z.ZodType>;
  };
  responses: Record<
    number,
    {
      description: string;
      body?: z.ZodType;
      contentType?: string;
      /** Optional example value for the response body (shown in Scalar). */
      example?: unknown;
    }
  >;
}

/** Convert a Zod schema to an OpenAPI-friendly JSON Schema object. */
export function zodSchemaToOpenApi(schema: z.ZodType): Record<string, unknown> {
  try {
    const json = z.toJSONSchema(schema, {
      target: 'openapi-3.0',
      // Break cycles / unrepresentable Zod constructs (lazy, custom, …).
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    const { $schema: _schema, ...rest } = json;
    return rest;
  } catch {
    try {
      const json = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>;
      const { $schema: _schema, ...rest } = json;
      return rest;
    } catch {
      return { type: 'object', description: 'Schema conversion fallback' };
    }
  }
}

/** @deprecated No longer registers into zod-to-openapi registry; kept for call-site compat. */
export function registerSchema(name: string, schema: z.ZodType): z.ZodType {
  void name;
  return schema;
}

/**
 * Register API route documentation for OpenAPI generation.
 * Converts Zod request/response schemas via `z.toJSONSchema` (c71).
 */
export function registerApiDoc(routes: OpenApiRoute[]): void {
  for (const route of routes) {
    const operation: Record<string, unknown> = {
      tags: route.tags ?? [],
      // Scalar collapsed title: prefer path visibility via summary ← path, description ← human summary
      summary: route.path,
      description: route.summary ?? route.description ?? '',
    };
    if (route.deprecated) {
      operation.deprecated = true;
    }

    if (route.request?.body) {
      operation.requestBody = {
        content: {
          'application/json': { schema: zodSchemaToOpenApi(route.request.body) },
        },
      };
    }

    const parameters: Record<string, unknown>[] = [];

    if (route.request?.params) {
      for (const [name, schema] of Object.entries(route.request.params)) {
        const s: Record<string, unknown> = schema as never;
        const desc = typeof s.description === 'string' ? s.description : undefined;
        parameters.push({
          name,
          in: 'path',
          required: true,
          description: desc,
          schema: zodSchemaToOpenApi(schema),
        });
      }
    }

    if (route.request?.query) {
      for (const [name, schema] of Object.entries(route.request.query)) {
        parameters.push({
          name,
          in: 'query',
          required: !schema.isOptional(),
          schema: zodSchemaToOpenApi(schema),
        });
      }
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    const responses: Record<string, unknown> = {};
    for (const [status, resp] of Object.entries(route.responses)) {
      const respObj: Record<string, unknown> = { description: resp.description };
      if (resp.body) {
        const mediaType: Record<string, unknown> = {
          schema: zodSchemaToOpenApi(resp.body),
        };
        if (resp.example !== undefined) {
          mediaType.example = resp.example;
        }
        respObj.content = {
          [resp.contentType ?? 'application/json']: mediaType,
        };
      }
      responses[status] = respObj;
    }
    operation.responses = responses;

    for (const tag of route.tags ?? []) {
      _allTags.add(tag);
    }

    _pathOps.push({ path: route.path, method: route.method, operation });
  }
}

/** Generate the full OpenAPI 3.1 document (stable under Zod v4 — c71). */
export function generateOpenApiDocument(info?: {
  title: string;
  version: string;
  description?: string;
}): Record<string, unknown> {
  const {
    title = 'Crystalith v2 API',
    version = '2.0.0-dev',
    description = 'RAG-powered knowledge notebook — v2 API',
  } = info ?? {};

  const paths: Record<string, Record<string, unknown>> = {};
  for (const { path, method, operation } of _pathOps) {
    if (!paths[path]) paths[path] = {};
    paths[path][method] = operation;
  }

  const doc: Record<string, unknown> = {
    openapi: '3.1.0',
    info: { title, version, description },
    servers: [{ url: '/', description: 'Crystalith v2 API' }],
    paths,
  };

  if (_allTags.size > 0) {
    doc.tags = [..._allTags].toSorted().map((name) => ({ name, description: '' }));
  }

  return doc;
}
