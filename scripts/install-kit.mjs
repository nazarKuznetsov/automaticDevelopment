#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(`Usage: scripts/install-kit.sh --target /path/to/repo MODE [--force] [--accept-host PATH]

Modes:
  --dry-run   Show the exact install or upgrade plan without writing.
  --apply     Install v2 into a repository that has no kit lock.
  --upgrade   Upgrade files tracked by an existing kit lock.

Options:
  --target PATH   Target repository root.
  --force         On upgrade only, overwrite a modified managed file recorded in the kit lock.
  --accept-host   Preserve one explicitly merged host-owned PATH; repeat for multiple paths.
  -h, --help      Show this help.`);
}

function parseArgs(argv) {
  const result = { target: "", mode: "", force: false, acceptHost: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") result.target = argv[++index] ?? "";
    else if (new Set(["--dry-run", "--apply", "--upgrade"]).has(argument)) {
      if (result.mode) throw new Error("Choose exactly one mode: --dry-run, --apply, or --upgrade.");
      result.mode = argument.slice(2);
    } else if (argument === "--force") result.force = true;
    else if (argument === "--accept-host") {
      const path = argv[++index] ?? "";
      if (!path) throw new Error("--accept-host requires a repository-relative path.");
      result.acceptHost.add(path.replaceAll("\\", "/").replace(/^\.\//, ""));
    }
    else if (argument === "--help" || argument === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(root, ...args) {
  try {
    return git(root, ...args);
  } catch {
    return "";
  }
}

function normalizeGitHubRepository(remoteUrl) {
  const value = String(remoteUrl ?? "").trim();
  const https = value.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (https) return https[1];
  const ssh = value.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (ssh) return ssh[1];
  const sshUrl = value.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshUrl) return sshUrl[1];
  return "";
}

function unsafeManifestPath(path) {
  const normalized = String(path ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  const localCodexMetadata = /^\.codex\/(?:(?:tasks|threads|sessions|worktrees|projects)(?:\/|$)|(?:task|thread|session|worktree|project)(?:-id)?\.json$)/.test(normalized);
  return !normalized
    || isAbsolute(normalized)
    || segments.includes("..")
    || segments.includes(".git")
    || segments.includes(".gitmodules")
    || normalized.startsWith(".codex/tasks/")
    || normalized.startsWith(".codex/worktrees/")
    || localCodexMetadata;
}

function defaultBranch(root) {
  const remoteHead = tryGit(root, "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD");
  if (remoteHead.startsWith("origin/")) return remoteHead.slice("origin/".length);
  for (const candidate of ["main", "master"]) {
    if (tryGit(root, "show-ref", "--verify", `refs/heads/${candidate}`)
      || tryGit(root, "show-ref", "--verify", `refs/remotes/origin/${candidate}`)) return candidate;
  }
  const current = tryGit(root, "symbolic-ref", "--quiet", "--short", "HEAD");
  if (current && !current.startsWith("agent/") && !current.startsWith("feature/")) return current;
  return "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  usage();
  fail(error.message);
}

if (args.help) {
  usage();
  process.exit(0);
}
if (!args.target) fail("Missing --target.");
if (!args.mode) fail("Choose a mode: --dry-run, --apply, or --upgrade.");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const kitRoot = join(repoRoot, "kit", "repo");
const manifestPath = join(repoRoot, "kit", "manifest.json");
const targetRoot = isAbsolute(args.target) ? resolve(args.target) : resolve(process.cwd(), args.target);
const lockPath = join(targetRoot, ".codex", "kit-lock.json");

if (!existsSync(manifestPath)) fail(`Kit manifest not found: ${manifestPath}`);
if (!existsSync(targetRoot) || !statSync(targetRoot).isDirectory()) fail(`Target directory not found: ${targetRoot}`);
if (!existsSync(join(targetRoot, ".git"))) fail(`Target does not look like a git repository root: ${targetRoot}`);

const manifest = readJson(manifestPath);
if (manifest.schema_version !== 2 || manifest.kit_version !== "2.1.0") {
  fail("Kit manifest must declare workflow schema 2 and kit version 2.1.0.");
}
if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail("Kit manifest has no files.");
const manifestPaths = manifest.files.map((entry) => entry.path);
if (new Set(manifestPaths).size !== manifestPaths.length) fail("Kit manifest contains duplicate paths.");
if (manifest.files.some((entry) => !new Set(["managed", "host", "generated"]).has(entry.ownership))) {
  fail("Kit manifest contains an invalid ownership class.");
}
if (manifest.files.some((entry) => unsafeManifestPath(entry.path))) {
  fail("Kit manifest contains Git metadata, local Codex metadata, or an unsafe path.");
}

const sourceRoot = tryGit(repoRoot, "rev-parse", "--show-toplevel");
if (resolve(sourceRoot) !== repoRoot) fail("Installer must run from a verified Git checkout of the Automation Kit.");
const sourceOriginUrl = tryGit(repoRoot, "remote", "get-url", "origin");
const sourceRepository = normalizeGitHubRepository(sourceOriginUrl);
const sourceCommit = tryGit(repoRoot, "rev-parse", "HEAD");
if (!sourceRepository || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
  fail("Kit source requires a GitHub origin and exact source commit.");
}
const sourceDirty = tryGit(repoRoot, "status", "--porcelain", "--", "kit/manifest.json", "kit/repo", "scripts/install-kit.mjs", "scripts/install-kit.sh");
if (sourceDirty) fail(`Kit source has uncommitted manifest changes:\n${sourceDirty}`);

const resolvedTargetRoot = tryGit(targetRoot, "rev-parse", "--show-toplevel");
if (!resolvedTargetRoot || realpathSync(resolvedTargetRoot) !== realpathSync(targetRoot)) {
  fail(`Target must be the exact Git repository or worktree root: ${targetRoot}`);
}
const targetOriginUrl = tryGit(targetRoot, "remote", "get-url", "origin");
const targetRepository = normalizeGitHubRepository(targetOriginUrl);
const targetDefaultBranch = defaultBranch(targetRoot);
if (!targetRepository || !targetDefaultBranch) {
  fail("Installation target requires a GitHub origin and an observable default branch.");
}
if (targetRepository === sourceRepository) {
  fail("Kit source and installation target must be different repositories.");
}

const previousLock = existsSync(lockPath) ? readJson(lockPath) : null;
if (previousLock) {
  if (!new Set([2, 3]).has(previousLock.schema_version)) {
    fail(`Unsupported kit lock schema: ${previousLock.schema_version ?? "<missing>"}.`);
  }
  if (!previousLock.files || typeof previousLock.files !== "object" || Array.isArray(previousLock.files)) {
    fail("Kit lock is missing its file ownership map.");
  }
  if (previousLock.schema_version === 2 && typeof previousLock.kit_version !== "string") {
    fail("Legacy v2 kit lock is missing kit_version.");
  }
  if (previousLock.schema_version === 3
    && (!previousLock.kit?.source_repository
      || !/^[0-9a-f]{40}$/.test(previousLock.kit?.source_commit ?? "")
      || !previousLock.target?.repository)) {
    fail("Kit lock v3 is missing source/target provenance.");
  }
}
if (args.mode === "apply" && previousLock) fail("A kit lock already exists; use --upgrade.");
if (args.mode === "upgrade" && !previousLock) fail("No .codex/kit-lock.json exists; use --apply first.");
const effectiveMode = args.mode === "dry-run" ? (previousLock ? "upgrade" : "apply") : args.mode;
if (args.force && effectiveMode !== "upgrade") {
  fail("--force is allowed only for an upgrade backed by an existing kit lock.");
}

const targetConfigPath = join(targetRoot, ".codex", "agent-workflow.json");
const targetConfig = existsSync(targetConfigPath) ? readJson(targetConfigPath) : null;
const configuredRepository = targetConfig?.github?.repository;
const lockedSourceRepository = previousLock?.kit?.source_repository;
const lockedTargetRepository = previousLock?.target?.repository;
const lockedTargetOrigin = previousLock?.target?.origin_url;
if (lockedSourceRepository && lockedSourceRepository !== sourceRepository) {
  fail(`Kit source identity mismatch: checkout=${sourceRepository}, lock=${lockedSourceRepository}.`);
}
if ((configuredRepository && configuredRepository !== targetRepository)
  || (lockedTargetRepository && lockedTargetRepository !== targetRepository)
  || (lockedTargetOrigin && normalizeGitHubRepository(lockedTargetOrigin) !== targetRepository)) {
  fail(`Target identity mismatch: remote=${targetRepository}, config=${configuredRepository || "<unset>"}, lock=${lockedTargetRepository || "<v2-unbound>"}.`);
}

const manifestByPath = new Map(manifest.files.map((entry) => [entry.path, entry]));
for (const path of args.acceptHost) {
  const entry = manifestByPath.get(path);
  if (!entry) fail(`--accept-host path is not in the kit manifest: ${path}`);
  if (entry.ownership !== "host") fail(`--accept-host applies only to host-owned files: ${path}`);
  if (!existsSync(join(targetRoot, path))) fail(`--accept-host target does not exist: ${path}`);
}

function safeTarget(path) {
  if (unsafeManifestPath(path)) fail(`Unsafe manifest path: ${path}`);
  let cursor = targetRoot;
  for (const segment of path.split("/")) {
    cursor = join(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail(`Refusing to write through a symbolic link: ${path}`);
    }
  }
  return cursor;
}

const operations = [];
const conflicts = [];
const nextFiles = {};

for (const entry of manifest.files) {
  const source = join(kitRoot, entry.path);
  const target = safeTarget(entry.path);
  if (!existsSync(source)) fail(`Manifest source is missing: ${entry.path}`);
  if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) {
    fail(`Manifest source must be a regular non-symlink file: ${entry.path}`);
  }

  const sourceHash = hashFile(source);
  const targetHash = existsSync(target) ? hashFile(target) : null;
  const locked = previousLock?.files?.[entry.path];
  let action = "COPY";

  let contentOrigin = "kit";

  if (targetHash === sourceHash) action = "KEEP";
  else if (!targetHash) action = "COPY";
  else if (entry.ownership === "host" && args.acceptHost.has(entry.path)) {
    action = "PRESERVE";
    contentOrigin = "host";
  } else if (effectiveMode === "apply") conflicts.push(entry);
  else if (locked && targetHash === locked.hash && locked.content_origin !== "host") action = "UPDATE";
  else if (args.force && entry.ownership === "managed" && locked) action = "OVERWRITE";
  else conflicts.push(entry);

  operations.push({ ...entry, action, source, target, sourceHash, targetHash, contentOrigin });
  nextFiles[entry.path] = {
    hash: action === "PRESERVE" ? targetHash : sourceHash,
    source_hash: sourceHash,
    ownership: entry.ownership,
    content_origin: contentOrigin,
  };
}

const manifestHash = hashFile(manifestPath);
const sourceTreeHash = createHash("sha256").update(JSON.stringify(
  operations
    .map((operation) => ({
      path: operation.path,
      ownership: operation.ownership,
      source_hash: operation.sourceHash,
    }))
    .sort((left, right) => left.path.localeCompare(right.path)),
)).digest("hex");

console.log(`Codex Automation Guide kit ${manifest.kit_version}`);
console.log(`Mode: ${args.mode}${args.mode === "dry-run" ? ` (${effectiveMode} preview)` : ""}`);
console.log(`Kit source: ${sourceRepository}@${sourceCommit}`);
console.log(`Installation target: ${targetRepository} (${targetDefaultBranch})`);
console.log(`Target path: ${targetRoot}`);
for (const operation of operations) {
  if (!conflicts.some((entry) => entry.path === operation.path)) {
    console.log(`${operation.action}: ${operation.path}`);
  }
}
for (const conflict of conflicts) {
  console.error(`MERGE REQUIRED: ${conflict.path} (${conflict.ownership})`);
  const operation = operations.find((item) => item.path === conflict.path);
  console.error(`  Kit: ${operation.source}`);
  console.error(`  Host: ${operation.target}`);
  if (conflict.ownership === "host") {
    console.error(`  After merging v2 requirements, rerun with --accept-host ${conflict.path}`);
  }
}

if (conflicts.length > 0) {
  console.error("No files were written. Merge the listed host/local changes, then rerun the same mode.");
  process.exit(1);
}

if (args.mode === "dry-run") {
  console.log("Dry run complete; no files copied.");
  process.exit(0);
}

for (const operation of operations) {
  if (new Set(["KEEP", "PRESERVE"]).has(operation.action)) continue;
  mkdirSync(dirname(operation.target), { recursive: true });
  copyFileSync(operation.source, operation.target);
}

mkdirSync(dirname(lockPath), { recursive: true });
writeFileSync(lockPath, `${JSON.stringify({
  schema_version: 3,
  kit: {
    version: manifest.kit_version,
    source_repository: sourceRepository,
    source_commit: sourceCommit,
    manifest_sha256: manifestHash,
    tree_sha256: sourceTreeHash,
  },
  target: {
    repository: targetRepository,
    origin_url: targetOriginUrl,
    default_branch: targetDefaultBranch,
  },
  installed_at: new Date().toISOString(),
  files: nextFiles,
}, null, 2)}\n`);
console.log(`Kit ${args.mode === "upgrade" ? "upgraded" : "installed"}. Review the diff before using the workflow.`);
