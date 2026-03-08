import { describe, expect, test } from "vitest";

import { resolveChangedLintTargets } from "./oxlint-targets.mjs";

describe("resolveChangedLintTargets", () => {
  test("keeps supported source files, deduplicates, and sorts results", () => {
    const targets = resolveChangedLintTargets({
      trackedPaths: [
        "src/z-last.tsx",
        "src/a-first.ts",
        "src/a-first.ts",
        "src/styles.css",
        "src/setupTests.ts",
      ],
      untrackedPaths: ["src/new-file.jsx", "README.md", "src/notes.txt"],
    });

    expect(targets).toEqual([
      "src/a-first.ts",
      "src/new-file.jsx",
      "src/setupTests.ts",
      "src/z-last.tsx",
    ]);
  });

  test("normalizes repo-root frontend paths to frontend-local paths", () => {
    const targets = resolveChangedLintTargets({
      trackedPaths: ["frontend/web/src/app/App.tsx"],
      untrackedPaths: [],
    });

    expect(targets).toEqual(["src/app/App.tsx"]);
  });

  test("includes modified tracked files from the working tree", () => {
    const targets = resolveChangedLintTargets({
      trackedPaths: [],
      stagedPaths: ["src/staged.tsx"],
      unstagedPaths: ["src/dirty.ts"],
      untrackedPaths: [],
    });

    expect(targets).toEqual(["src/dirty.ts", "src/staged.tsx"]);
  });

  test("drops generated and non-source paths", () => {
    const targets = resolveChangedLintTargets({
      trackedPaths: [
        "src/api/generated/client.ts",
        "src/api/generated/models/foo.ts",
        "vite.config.ts",
        "src/components/Button.tsx",
      ],
      untrackedPaths: ["src/api/generated/bar.js", "src/components/Card.jsx"],
    });

    expect(targets).toEqual(["src/components/Button.tsx", "src/components/Card.jsx"]);
  });
});
