#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { evaluateAdmission } from "./workflow-contract.mjs";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--evidence") result.evidence = argv[++index];
    else if (argv[index] === "--report") result.report = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!result.evidence) throw new Error("Usage: pre-pr-gate.mjs --evidence <json> [--report <json>]");
  return result;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function markdown(report, evidence) {
  return [
    "## Pre-PR Admission Report",
    "",
    "Schema: 2",
    `Issue: #${evidence.issue?.number ?? "unknown"}`,
    `Commit SHA: ${report.commit_sha ?? "unknown"}`,
    `Status: ${report.status}`,
    `PR action: ${report.pr_action}`,
    "",
    "Blockers:",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- none"]),
  ].join("\n");
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const root = git("rev-parse", "--show-toplevel");
const currentSha = git("rev-parse", "HEAD");
const currentBranch = git("branch", "--show-current");
const gitDirValue = git("rev-parse", "--git-dir");
const gitDir = isAbsolute(gitDirValue) ? gitDirValue : resolve(root, gitDirValue);
const markerPath = resolve(gitDir, "codex-agent", "pre-pr-admission.json");
const consumptionPath = resolve(gitDir, "codex-agent", "pre-pr-admission.consume.json");
for (const path of [markerPath, consumptionPath]) {
  if (existsSync(path)) unlinkSync(path);
}

const configPath = resolve(root, ".codex", "agent-workflow.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.schema_version !== 2 || config.configured !== true) {
  console.error(".codex/agent-workflow.json must be verified and configured before admission.");
  process.exit(1);
}
const evidencePath = resolve(args.evidence);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
for (const scope of ["targeted", "full"]) {
  const validation = spawnSync(process.execPath, [resolve(root, ".codex", "scripts", "run-validation.mjs"), "--scope", scope], {
    cwd: root,
    stdio: "inherit",
  });
  if (validation.status !== 0) {
    console.error(`Admission stopped: ${scope} validation failed during the gate.`);
    process.exit(validation.status ?? 1);
  }
}
const report = evaluateAdmission({
  ...evidence,
  current_sha: currentSha,
  current_branch: currentBranch,
  configured_validation: {
    targeted: config.validation?.targeted,
    full: config.validation?.full,
    branch_ci_workflow: config.validation?.branch_ci_workflow,
  },
});
const reportPath = args.report
  ? resolve(args.report)
  : resolve(gitDir, "codex-agent", "pre-pr-admission-report.json");

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ ...report, schema_version: 2 }, null, 2)}\n`);
console.log(markdown(report, evidence));

if (report.status === "PASS" && report.pr_action === "CREATE_ONCE") {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${JSON.stringify({
    schema_version: 2,
    status: "PASS",
    commit_sha: currentSha,
    report_path: reportPath,
    generated_at: new Date().toISOString(),
  }, null, 2)}\n`);
  process.exit(0);
}

process.exit(report.status === "PASS" ? 0 : 1);
