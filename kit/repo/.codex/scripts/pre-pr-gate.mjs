#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

function authoritativeBaseSha(branch) {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("Invalid default branch name.");
  execFileSync("git", ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  const sha = git("rev-parse", `refs/remotes/origin/${branch}`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Remote default branch did not return a full SHA.");
  return sha;
}

function markdown(report, evidence) {
  return [
    "## Pre-PR Admission Report",
    "",
    "Schema: 2",
    `Issue: #${evidence.issue?.number ?? "unknown"}`,
    `Head SHA: ${report.commit_sha ?? "unknown"}`,
    `Base SHA at launch: ${evidence.base_sha_at_launch ?? "unknown"}`,
    `Validated base SHA: ${evidence.validated_base_sha ?? "unknown"}`,
    `Admission source: ${evidence.reviews?.admission?.source?.id ?? "unknown"}`,
    "QA tracked tree: CLEAN",
    "Gate tracked tree: CLEAN",
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
const defaultBranch = config.github?.default_branch;
if (typeof defaultBranch !== "string" || defaultBranch.trim().length === 0) {
  console.error("github.default_branch must be configured before admission.");
  process.exit(1);
}
let currentBaseSha;
try {
  currentBaseSha = authoritativeBaseSha(defaultBranch);
} catch {
  console.error(`Unable to read authoritative origin/${defaultBranch}; admission fails closed.`);
  process.exit(1);
}
const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", currentBaseSha, currentSha]);
if (ancestry.status !== 0) {
  console.error("Admission stopped: current HEAD does not contain the authoritative default-branch revision.");
  process.exit(1);
}
const trackedBefore = git("status", "--porcelain", "--untracked-files=no");
if (trackedBefore !== "") {
  console.error("Admission stopped: tracked worktree is dirty before validation.");
  process.exit(1);
}
const evidencePath = resolve(args.evidence);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
for (const scope of ["targeted", "full", "integration"]) {
  const validation = spawnSync(process.execPath, [resolve(root, ".codex", "scripts", "run-validation.mjs"), "--scope", scope], {
    cwd: root,
    stdio: "inherit",
  });
  if (validation.status !== 0) {
    console.error(`Admission stopped: ${scope} validation failed during the gate.`);
    process.exit(validation.status ?? 1);
  }
}
const trackedAfter = git("status", "--porcelain", "--untracked-files=no");
if (trackedAfter !== "") {
  console.error("Admission stopped: validation or QA left tracked worktree changes.");
  process.exit(1);
}
const report = evaluateAdmission({
  ...evidence,
  current_sha: currentSha,
  current_base_sha: currentBaseSha,
  current_branch: currentBranch,
  gate_tracked_worktree: { status: "CLEAN", before: trackedBefore, after: trackedAfter },
  configured_validation: {
    targeted: config.validation?.targeted,
    full: config.validation?.full,
    integration: config.validation?.integration,
    branch_ci_workflow: config.validation?.branch_ci_workflow,
  },
});
const reportPath = args.report
  ? resolve(args.report)
  : resolve(gitDir, "codex-agent", "pre-pr-admission-report.json");

mkdirSync(dirname(reportPath), { recursive: true });
const reportPayload = {
  ...report,
  schema_version: 2,
  base_sha: currentBaseSha,
  admission_source_id: evidence.reviews?.admission?.source?.id,
};
const reportDigest = createHash("sha256").update(JSON.stringify(reportPayload)).digest("hex");
writeFileSync(reportPath, `${JSON.stringify({ ...reportPayload, report_digest: reportDigest }, null, 2)}\n`);
console.log(markdown(report, evidence));

if (report.status === "PASS" && report.pr_action === "CREATE_ONCE") {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${JSON.stringify({
    schema_version: 2,
    status: "PASS",
    commit_sha: currentSha,
    base_sha: currentBaseSha,
    admission_source_id: evidence.reviews?.admission?.source?.id,
    report_digest: reportDigest,
    report_path: reportPath,
    generated_at: new Date().toISOString(),
  }, null, 2)}\n`);
  process.exit(0);
}

process.exit(report.status === "PASS" ? 0 : 1);
