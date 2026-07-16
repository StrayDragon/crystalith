// OpenAPI 3.1 document generation from shared Zod schemas.
//
// Uses @asteasolutions/zod-to-openapi to register schemas + paths, then
// generates an OpenAPI 3.1 JSON document served at GET /openapi.json.
// External SDK users (Python/Go/Rust) consume this endpoint via
// openapi-generator-cli.
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with .openapi() metadata once.
extendZodWithOpenApi(z);

// Collect unique tags for the document root.
const _allTags = new Set<string>();

export interface OpenApiRoute {
  path: string;
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  summary?: string;
  description?: string;
  tags?: string[];
  request?: {
    body?: z.ZodTypeAny;
    params?: Record<string, z.ZodTypeAny>;
    query?: Record<string, z.ZodTypeAny>;
  };
  responses: Record<
    number,
    {
      description: string;
      body?: z.ZodTypeAny;
      contentType?: string;
    }
  >;
}

const registry = new OpenAPIRegistry();

/** Register a schema under a component name for $ref reuse. */
export function registerSchema(name: string, schema: z.ZodTypeAny): z.ZodTypeAny {
  return registry.register(refName(name), schema);
}

function refName(name: string): string {
  return name;
}

/**
 * Register API route documentation for OpenAPI generation.
 *
 * The canonical call-site is server.ts (scaffold) or each
 * features router module once c04 lands. The actual Elysia handler
 * lives on the app instance (.get / .post); the OpenApiRoute descriptor here
 * mirrors it for OpenAPI doc generation only.
 */
export function registerApiDoc(routes: OpenApiRoute[]): void {
  for (const route of routes) {
    // Scalar uses 'summary' as the collapsed endpoint title.
    // We want the path visible, so swap: summary ← path, description ← summary.
    const pathItem: Record<string, unknown> = {
      tags: route.tags ?? [],
      description: route.summary ?? '',
    };

    if (route.request?.body) {
      pathItem.requestBody = {
        content: {
          'application/json': { schema: route.request.body },
        },
      };
    }

    if (route.request?.params) {
      pathItem.parameters = Object.entries(route.request.params).map(([name, schema]) => {
        // Resolve Zod v4 schema to OpenAPI parameter object.
        // zod-to-openapi v7 does not support Zod v4, so we extract
        // metadata directly from the schema instance.
        const s: Record<string, unknown> = schema as never;
        const desc = typeof s.description === 'string' ? s.description : undefined;
        return {
          name,
          in: 'path',
          required: true,
          description: desc,
          schema: { type: s.type === 'number' ? 'integer' : 'string' },
        };
      });
    }

    if (route.request?.query) {
      const queryParams = Object.entries(route.request.query).map(([name, schema]) => ({
        name,
        in: 'query',
        required: !schema.isOptional(),
        schema,
      }));
      pathItem.parameters = [...((pathItem.parameters as unknown[]) ?? []), ...queryParams];
    }

    pathItem.responses = {} as Record<string, unknown>;
    for (const [status, resp] of Object.entries(route.responses)) {
      const respObj: Record<string, unknown> = { description: resp.description };
      if (resp.body) {
        respObj.content = {
          [resp.contentType ?? 'application/json']: { schema: resp.body },
        };
      }
      (pathItem.responses as Record<string, unknown>)[status] = respObj;
    }

    // Collect tags for document root.
    for (const tag of route.tags ?? []) {
      _allTags.add(tag);
    }

    registry.registerPath({
      path: route.path,
      method: route.method,
      ...pathItem,
    } as Parameters<typeof registry.registerPath>[0]);
  }
}

/** Generate the full OpenAPI 3.1 document. */
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
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: { title, version, description },
    servers: [{ url: '/', description: 'Crystalith v2 API' }],
  }) as unknown as Record<string, unknown>;

  // Inject tags for Scalar UI grouping.
  if (_allTags.size > 0) {
    doc.tags = [..._allTags].toSorted().map((name) => ({ name, description: '' }));
  }

  return doc;
}

// Note: schemas are inlined into path definitions rather than registered as
// named components. This avoids the zod-v4 prototype timing issue where
// extendZodWithOpenApi must run before schema creation. The generated
// OpenAPI doc is fully valid — schemas appear inline in responses/requestBodies.
