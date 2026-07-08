// AI agent tools — registered with streamText for the RAG agent loop.
//
// Each tool is a Vercel AI SDK `tool()` with a Zod parameter schema (from
// @crystalith/shared) and an `execute` function. The tools are wired into
// the QA pipeline and the research agent.
export { retrieveSourcesTool, type RetrieveSourcesArgs } from "./retrieve-sources.ts";
export { webSearchTool, type WebSearchArgs, type WebSearchResultItem } from "./web-search.ts";
