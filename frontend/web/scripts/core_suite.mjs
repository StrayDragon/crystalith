#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(frontendDir, "..", "..");
const manifestPath = path.resolve(
  repoRoot,
  "llmanspec",
  "specs",
  "quality-and-regression",
  "core_suite.json",
);

function readJson(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text);
}

function asStringArray(value, context) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid ${context}: expected string[]`);
  }
  return value;
}

function uniqueStable(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function loadCoreVitestFiles() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Core suite manifest not found: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const corePaths = Array.isArray(manifest.corePaths) ? manifest.corePaths : [];

  const extra = asStringArray(manifest.frontend?.extraVitestFiles, "frontend.extraVitestFiles");
  const domainFiles = corePaths.flatMap((entry) =>
    asStringArray(entry?.frontend?.vitestFiles, `corePaths[].frontend.vitestFiles (${entry?.id})`),
  );

  const files = uniqueStable([...extra, ...domainFiles]);

  for (const file of files) {
    const absPath = path.resolve(frontendDir, file);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Core suite vitest file missing: ${file}`);
    }
  }

  return files;
}

function usage() {
  console.error("Usage:");
  console.error("  node scripts/core_suite.mjs print");
  console.error("  node scripts/core_suite.mjs run [-- <vitest args>]");
}

const argv = process.argv.slice(2);
const subcommand = argv[0] ?? "run";

let forwarded = argv.slice(1);
if (forwarded[0] === "--") forwarded = forwarded.slice(1);

let files;
try {
  files = loadCoreVitestFiles();
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(2);
}

if (subcommand === "print") {
  console.log(files.join(" "));
  process.exit(0);
}

if (subcommand === "run") {
  const result = spawnSync("vitest", ["run", ...files, ...forwarded], {
    stdio: "inherit",
    cwd: frontendDir,
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

usage();
process.exit(2);
