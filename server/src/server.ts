import { Elysia, t } from "elysia";

const app = new Elysia()
  // Health check
  .get("/health", () => ({ status: "ok", version: "2.0.0-dev" }))

  // API v2 prefix
  .group("/v2", (app) =>
    app
      .get("/", () => ({ message: "Crystalith v2 API" }))

      // Placeholder: notebooks
      .get("/notebooks", () => ({ notebooks: [] }))
  )

  .listen({
    port: process.env.CL_SERVER_PORT
      ? parseInt(process.env.CL_SERVER_PORT)
      : 8032,
  });

console.log(
  `🦊 Crystalith v2 server running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
