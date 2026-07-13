import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const kitRoot = join(root, "kit", "repo");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function filesUnder(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(relative(kitRoot, path).replaceAll("\\", "/"));
  }
  return files.sort();
}

const required = [
  "src/pages/index.astro",
  "src/pages/docs/[slug].astro",
  "src/layouts/DocLayout.astro",
  "kit/manifest.json",
  "kit/repo/.codex/agent-workflow.json",
  "kit/repo/.codex/hooks.json",
  "kit/repo/.codex/scripts/pre-pr-gate.mjs",
  "kit/repo/.github/workflows/agent-branch-validation.yml",
  "kit/repo/.github/workflows/readiness-audit.yml",
  "kit/repo/docs/product/canonical.md",
];

for (const path of required) {
  if (!existsSync(join(root, path))) fail(`missing ${path}`);
}

const manifest = JSON.parse(readFileSync(join(root, "kit", "manifest.json"), "utf8"));
if (manifest.schema_version !== 2 || manifest.kit_version !== "2.0.0") fail("manifest is not workflow v2");
const manifestPaths = manifest.files.map((entry) => entry.path).sort();
const kitFiles = filesUnder(kitRoot);
if (JSON.stringify(manifestPaths) !== JSON.stringify(kitFiles)) {
  const missing = kitFiles.filter((path) => !manifestPaths.includes(path));
  const stale = manifestPaths.filter((path) => !kitFiles.includes(path));
  fail(`manifest drift; missing=[${missing.join(", ")}] stale=[${stale.join(", ")}]`);
}
if (manifest.files.some((entry) => !new Set(["host", "managed"]).has(entry.ownership))) fail("manifest has invalid ownership");

const guideFiles = kitFiles.filter((path) => path.startsWith("docs/guide/") && path.endsWith(".md"));
const expectedGuide = ["contracts", "design-gate", "existing-products", "github-model", "human-gates", "lifecycle", "operations", "orchestration", "planning", "pre-pr-gate", "quickstart", "troubleshooting", "worker-tdd"];
for (const slug of expectedGuide) {
  if (!guideFiles.includes(`docs/guide/${slug}.md`)) fail(`missing canonical guide page: ${slug}`);
}

for (const path of kitFiles.filter((path) => path.endsWith(".json"))) {
  try { JSON.parse(readFileSync(join(kitRoot, path), "utf8")); }
  catch (error) { fail(`${path} is invalid JSON: ${error.message}`); }
}

const skills = ["project-brainstorm", "github-project-planner", "github-agent-orchestrator", "github-agent-worker", "github-pre-pr-reviewer"];
for (const skill of skills) {
  const skillPath = join(kitRoot, ".agents", "skills", skill, "SKILL.md");
  const yamlPath = join(kitRoot, ".agents", "skills", skill, "agents", "openai.yaml");
  if (!existsSync(skillPath) || !existsSync(yamlPath)) fail(`incomplete skill: ${skill}`);
  if (!readFileSync(skillPath, "utf8").includes(`name: ${skill}`)) fail(`skill name mismatch: ${skill}`);
  if (!readFileSync(yamlPath, "utf8").includes(`$${skill}`)) fail(`skill default_prompt must mention $${skill}`);
}

const workflow = JSON.parse(readFileSync(join(kitRoot, ".codex", "agent-workflow.json"), "utf8"));
if (workflow.schema_version !== 2 || workflow.execution.max_workers !== 2 || workflow.execution.wave_limit !== 5 || workflow.execution.duplicate_lookback_days !== 90 || workflow.execution.heartbeat_minutes !== 20) {
  fail("workflow defaults drifted");
}

const readiness = readFileSync(join(kitRoot, ".github", "workflows", "readiness-audit.yml"), "utf8");
for (const needle of ["removeLabel", "updateComment", "subIssues", "readiness-audit.cjs"]) {
  if (!readiness.includes(needle)) fail(`readiness workflow missing ${needle}`);
}

const route = readFileSync(join(root, "src", "pages", "docs", "[slug].astro"), "utf8");
if (!route.includes('import.meta.glob("../../../kit/repo/docs/guide/*.md"')) fail("site does not render canonical guide glob");

const textFiles = kitFiles.filter((path) => /\.(md|yml|yaml|toml|mjs|cjs|py|json)$/.test(path));
for (const path of textFiles) {
  const content = readFileSync(join(kitRoot, path), "utf8");
  if (/\bTO[D]O\b|\bT[B]D\b/.test(content)) fail(`${path} contains unresolved placeholder text`);
}

console.log(`PASS: workflow v2 validated (${kitFiles.length} kit files, ${guideFiles.length} canonical guide pages)`);
