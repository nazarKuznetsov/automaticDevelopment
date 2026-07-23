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

function gitRaw(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function authoritativeDefaultBranch() {
  const remoteHead = gitRaw("ls-remote", "--symref", "origin", "HEAD");
  const branch = remoteHead.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD$/m)?.[1] ?? "";
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error("Remote HEAD did not return a valid default branch.");
  }
  return branch;
}

function authoritativeBaseSha(branch) {
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("Invalid default branch name.");
  execFileSync("git", ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  const sha = git("rev-parse", `refs/remotes/origin/${branch}`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Remote default branch did not return a full SHA.");
  return sha;
}

function canonicalTreeState(root, baseSha, headSha, baseConfigText, currentConfigText, publication) {
  const canonicalPath = "docs/product/canonical.md";
  const currentText = readFileSync(resolve(root, canonicalPath), "utf8");
  const baseText = gitRaw("show", `${baseSha}:${canonicalPath}`);
  const revision = (content) => content.match(/^Revision: `([^`]+)`\.$/m)?.[1] ?? "";
  const approvedBy = currentText.match(/^- Approved by: `([^`]+)`$/m)?.[1] ?? "";
  const changedPaths = git("diff", "--name-only", `${baseSha}...${headSha}`)
    .split("\n")
    .filter(Boolean);
  const contentHashes = {};
  for (const path of Object.keys(publication?.content_hashes ?? {})) {
    if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.split("/").includes("..")) {
      throw new Error("Canonical publication contains an invalid approved path.");
    }
    contentHashes[path] = createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
  }
  return {
    changed_paths: changedPaths,
    base_revision: revision(baseText),
    current_revision: revision(currentText),
    current_approved_by: approvedBy,
    current_text: currentText,
    config_unchanged: currentConfigText === baseConfigText,
    content_hashes: contentHashes,
  };
}

function runConfiguredValidation(root, config, scope) {
  const commands = config.validation?.[scope];
  if (!Array.isArray(commands)
    || commands.length === 0
    || commands.some((command) => typeof command !== "string" || command.trim().length === 0 || /^\s*#/.test(command))) {
    throw new Error(`No substantive ${scope} validation commands are configured in authoritative base.`);
  }
  for (const command of commands) {
    console.log(`> ${command}`);
    const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit", env: process.env });
    if (result.status !== 0) return result.status ?? 1;
  }
  console.log(`PASS: ${scope} validation`);
  return 0;
}

function markdown(report, evidence) {
  const subject = evidence.canonical_publication
    ? `Canonical publication: ${evidence.canonical_publication.canonical_revision}`
    : evidence.bootstrap
      ? `Bootstrap: ${evidence.bootstrap.authority}`
      : `Issue: #${evidence.issue?.number ?? "unknown"}`;
  return [
    "## Pre-PR Admission Report",
    "",
    "Schema: 2",
    subject,
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
if (existsSync(markerPath)) unlinkSync(markerPath);
let consumedForCurrentSha = false;
if (existsSync(consumptionPath)) {
  try {
    const consumption = JSON.parse(readFileSync(consumptionPath, "utf8"));
    if (consumption.commit_sha === currentSha) consumedForCurrentSha = true;
    else unlinkSync(consumptionPath);
  } catch {
    console.error("Admission stopped: the existing PR authorization consumption record is invalid.");
    process.exit(1);
  }
}

let defaultBranch;
let currentBaseSha;
let baseConfigText;
let currentConfigText;
let config;
try {
  defaultBranch = authoritativeDefaultBranch();
  currentBaseSha = authoritativeBaseSha(defaultBranch);
  baseConfigText = gitRaw("show", `${currentBaseSha}:.codex/agent-workflow.json`);
  currentConfigText = readFileSync(resolve(root, ".codex", "agent-workflow.json"), "utf8");
  config = JSON.parse(baseConfigText);
} catch {
  console.error("Unable to read authoritative origin default branch and base configuration; admission fails closed.");
  process.exit(1);
}
if (config.schema_version !== 2
  || config.configured !== true
  || config.github?.default_branch !== defaultBranch
  || typeof config.github?.repository !== "string"
  || config.github.repository.trim().length === 0) {
  console.error("Authoritative base .codex/agent-workflow.json is not verified or does not match remote HEAD.");
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
  const status = runConfiguredValidation(root, config, scope);
  if (status !== 0) {
    console.error(`Admission stopped: ${scope} validation failed during the gate.`);
    process.exit(status);
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
  raw_evidence_keys: Object.keys(evidence),
  gate_tracked_worktree: { status: "CLEAN", before: trackedBefore, after: trackedAfter },
  configured_validation: {
    targeted: config.validation?.targeted,
    full: config.validation?.full,
    integration: config.validation?.integration,
    branch_ci_workflow: config.validation?.branch_ci_workflow,
  },
  configured_automation_profile: config.execution?.automation_profile ?? "team_safe",
  configured_bootstrap: config.bootstrap,
  configured_canonical_publication: config.canonical_publication,
  canonical_tree_state: evidence.canonical_publication
    ? canonicalTreeState(
      root,
      currentBaseSha,
      currentSha,
      baseConfigText,
      currentConfigText,
      config.canonical_publication,
    )
    : undefined,
});
const reportPath = args.report
  ? resolve(args.report)
  : resolve(gitDir, "codex-agent", "pre-pr-admission-report.json");

mkdirSync(dirname(reportPath), { recursive: true });
const reportPayload = {
  ...report,
  schema_version: 2,
  base_sha: currentBaseSha,
  admission_source_id: evidence.reviews?.admission?.source?.id ?? evidence.reviews?.reviewer_qa?.source?.id,
};
const reportDigest = createHash("sha256").update(JSON.stringify(reportPayload)).digest("hex");
writeFileSync(reportPath, `${JSON.stringify({ ...reportPayload, report_digest: reportDigest }, null, 2)}\n`);
console.log(markdown(report, evidence));

if (report.status === "PASS" && report.pr_action === "CREATE_ONCE") {
  if (consumedForCurrentSha) {
    console.error("PR creation authorization was already consumed for this commit SHA.");
    process.exit(1);
  }
  const markerSubject = evidence.canonical_publication
    ? `canonical_publication:${evidence.canonical_publication.canonical_revision}`
    : evidence.bootstrap
      ? `bootstrap:${evidence.bootstrap.authority}`
      : `issue:${evidence.issue?.number ?? "unknown"}`;
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${JSON.stringify({
    schema_version: 2,
    status: "PASS",
    commit_sha: currentSha,
    base_sha: currentBaseSha,
    admission_source_id: evidence.reviews?.admission?.source?.id,
    report_digest: reportDigest,
    report_path: reportPath,
    repository: config.github.repository,
    head_branch: currentBranch,
    base_branch: defaultBranch,
    draft: true,
    subject: markerSubject,
    generated_at: new Date().toISOString(),
  }, null, 2)}\n`);
  process.exit(0);
}

process.exit(report.status === "PASS" ? 0 : 1);
