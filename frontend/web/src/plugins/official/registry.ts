import type { BundleRenderFn } from "./shared";

export type BuiltinBundleModule = {
  render: BundleRenderFn;
};

export const builtinBundleLoaders: Record<string, () => Promise<BuiltinBundleModule>> = {
  "output-faq": () => import("./output-faq"),
  "output-guide": () => import("./output-guide"),
  "output-timeline": () => import("./output-timeline"),
  "output-mindmap": () => import("./output-mindmap"),
  "output-quiz": () => import("./output-quiz"),
  "output-briefing": () => import("./output-briefing"),
  "output-slides": () => import("./output-slides"),
};

export function getBuiltinBundleLoader(id: string): (() => Promise<BuiltinBundleModule>) | null {
  return builtinBundleLoaders[id] ?? null;
}
