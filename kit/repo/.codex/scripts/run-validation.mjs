#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scopeIndex = process.argv.indexOf("--scope");
const scope = scopeIndex === -1 ? "full" : process.argv[scopeIndex + 1];
if (!new Set(["targeted", "full", "visual"]).has(scope)) {
  console.error("Usage: run-validation.mjs --scope targeted|full|visual");
  process.exit(2);
}

const configPath = resolve(process.cwd(), ".codex", "agent-workflow.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.schema_version !== 2 || config.configured !== true) {
  console.error(".codex/agent-workflow.json must be configured with schema_version 2 before validation.");
  process.exit(1);
}

const commands = config.validation?.[scope] ?? [];
if (!Array.isArray(commands)
  || commands.length === 0
  || commands.some((command) => typeof command !== "string" || command.trim().length === 0 || /^\s*#/.test(command))) {
  console.error(`No substantive ${scope} validation commands are configured.`);
  process.exit(1);
}

for (const command of commands) {
  console.log(`> ${command}`);
  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`PASS: ${scope} validation`);
