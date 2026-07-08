import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "README.md",
  "INSTALL.md",
  "astro.config.mjs",
  "package.json",
  "src/pages/index.astro",
  "src/styles/global.css",
  "src/scripts/tech-core.ts",
  ".github/workflows/deploy-pages.yml",
  "kit/repo/AGENTS.md",
  "kit/repo/docs/github-agent-workflow.md",
  "kit/repo/.github/ISSUE_TEMPLATE/agent-task.yml",
  "kit/repo/.github/ISSUE_TEMPLATE/config.yml",
  "kit/repo/.github/pull_request_template.md",
  "kit/repo/.github/workflows/readiness-audit.yml",
  "kit/repo/.agents/skills/github-agent-orchestrator/SKILL.md",
  "kit/repo/.agents/skills/github-agent-worker/SKILL.md",
  "scripts/install-kit.sh",
];

const requiredContent = [
  ["astro.config.mjs", "base: \"/automaticDevelopment\""],
  ["astro.config.mjs", "site: \"https://nazarkuznetsov.github.io\""],
  ["src/pages/index.astro", "Codex Automation Guide"],
  ["src/pages/index.astro", "Start Setup"],
  ["src/pages/index.astro", "View Resources"],
  ["src/pages/index.astro", "Tech Core"],
  ["src/scripts/tech-core.ts", "prefers-reduced-motion"],
  ["kit/repo/docs/github-agent-workflow.md", "Project Intake Packet"],
  ["kit/repo/docs/github-agent-workflow.md", "GitHub Setup Packet"],
  ["kit/repo/docs/github-agent-workflow.md", "Max active workers: 2"],
  ["kit/repo/.agents/skills/github-agent-orchestrator/SKILL.md", "name: github-agent-orchestrator"],
  ["kit/repo/.agents/skills/github-agent-worker/SKILL.md", "name: github-agent-worker"],
];

const placeholderTokens = [["TO", "DO"].join(""), ["T", "BD"].join("")];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

for (const file of requiredFiles) {
  if (!existsSync(join(process.cwd(), file))) {
    fail(`missing ${file}`);
  }
}

for (const [file, needle] of requiredContent) {
  const content = readFileSync(join(process.cwd(), file), "utf8");
  if (!content.includes(needle)) {
    fail(`${file} missing ${needle}`);
  }
}

const allFiles = requiredFiles.filter((file) => file.endsWith(".md") || file.endsWith(".astro") || file.endsWith(".ts") || file.endsWith(".yml") || file.endsWith(".yaml"));
for (const file of allFiles) {
  const content = readFileSync(join(process.cwd(), file), "utf8");
  if (placeholderTokens.some((token) => content.includes(token))) {
    fail(`${file} contains unresolved placeholder text`);
  }
}

console.log("PASS: site and kit structure validated");
