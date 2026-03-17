#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveChangedLintTargets } from "./oxlint-targets.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const baseRef = process.env.CRYSTALITH_FRONTEND_LINT_BASE || "origin/main";

function readGitLines(args) {
  const result = spawnSync("git", args, {
    cwd: frontendDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasGitRef(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", ref], {
    cwd: frontendDir,
    stdio: "ignore",
  });

  return result.status === 0;
}

const trackedPaths = hasGitRef(baseRef)
  ? readGitLines(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`, "--", "src"])
  : [];

const stagedPaths = readGitLines([
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  "--cached",
  "--",
  "src",
]);
const unstagedPaths = readGitLines(["diff", "--name-only", "--diff-filter=ACMR", "--", "src"]);
const untrackedPaths = readGitLines(["ls-files", "--others", "--exclude-standard", "--", "src"]);

const targets = resolveChangedLintTargets({
  trackedPaths,
  stagedPaths,
  unstagedPaths,
  untrackedPaths,
});

if (targets.length === 0) {
  console.log("No changed frontend source files to lint.");
  process.exit(0);
}

const result = spawnSync(
  "oxlint",
  [
    "--deny-warnings",
    "--max-warnings=0",
    "--config",
    ".oxlintrc.json",
    "--tsconfig",
    "tsconfig.json",
    ...targets,
  ],
  {
    cwd: frontendDir,
    stdio: "inherit",
    env: process.env,
  },
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
