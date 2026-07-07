import { Elysia } from "elysia";
import { desc } from "drizzle-orm";

import { db } from "./db/index.ts";
import { notebooks } from "./db/schema.ts";
import { generateOpenApiDocument, registerRoutes, type OpenApiRoute } from "./openapi.ts";
import { generateAsyncApiDocument } from "./asyncapi.ts";

// ---------------------------------------------------------------------------
// Route definitions (registered for OpenAPI generation + mounted on the app)
// ---------------------------------------------------------------------------

const routes: OpenApiRoute[] = [
  {
    path: "/v2/notebooks",
    method: "get",
    summary: "List all notebooks",
    tags: ["notebooks"],
    responses: {
      200: {
        description: "List of notebooks",
        body: (await import("@crystalith/shared")).NotebookListSchema,
      },
    },
  },
  {
    path: "/v2/health",
    method: "get",
    summary: "Health check",
    tags: ["system"],
    responses: {
      200: { description: "Server health status" },
    },
  },
  {
    path: "/v2/models",
    method: "get",
    summary: "List available models",
    tags: ["models"],
    responses: {
      200: {
        description: "Available model configurations",
        body: (await import("@crystalith/shared")).ModelListSchema,
      },
    },
  },
];

registerRoutes(routes);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Elysia()
  // Health check
  .get("/health", () => ({ status: "ok", version: "2.0.0-dev" }))

  // OpenAPI + AsyncAPI document endpoints
  .get("/openapi.json", () => generateOpenApiDocument())
  .get("/asyncapi.json", () => generateAsyncApiDocument())

  // API v2 prefix
  .group("/v2", (app) =>
    app
      .get("/", () => ({ message: "Crystalith v2 API" }))

      // Health (under v2 prefix)
      .get("/health", () => ({ status: "ok" }))

      // Notebooks
      .get("/notebooks", () => {
        const rows = db()
          .select()
          .from(notebooks)
          .orderBy(desc(notebooks.updatedAt))
          .all();
        return { notebooks: rows.map(serializeNotebook) };
      })

      // Models (read-only from config)
      .get("/models", () => {
        const { getModels, getModelDefaults } = require("./shared/config");
        const models = getModels();
        const defaults = getModelDefaults();
        return {
          defaults,
          models: models.available.map((m: any) => ({
            id: m.id,
            provider: m.provider,
            model: m.model,
            display_name: m.display_name,
            description: m.description,
            roles: m.roles,
            capabilities: m.capabilities,
            is_default_chat: defaults.chat === m.id,
            is_default_embedding: defaults.embedding === m.id,
          })),
        };
      }),
  )

  .listen({
    port: process.env.CL_SERVER_PORT ? parseInt(process.env.CL_SERVER_PORT) : 8032,
  });

console.log(
  `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;

// ---------------------------------------------------------------------------
// Serialization helpers (Drizzle row → API response)
// ---------------------------------------------------------------------------

function serializeNotebook(row: {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
