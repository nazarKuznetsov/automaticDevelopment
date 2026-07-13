const FIELD_NAMES = {
  "Goal": "goal",
  "Acceptance Criteria": "acceptance",
  "Dependency / Blocker State": "blockers",
  "Validation Expectations": "validation",
  "Primary Signal": "primary_signal",
  "Secondary Signals": "secondary_signals",
  "Work Type": "work_type",
  "Phase": "phase",
  "Size": "size",
  "Risk": "risk",
  "QA Required": "qa_required",
  "Security Impact": "security",
  "UI / Design Impact": "design",
  "TDD / Exemption": "tdd",
  "Repository Tracing": "tracing",
  "Human Gates": "human_gates",
};

const PLACEHOLDER_VALUE = /^(?:_?no response_?|n\/?a|tbd|todo|unknown|<[^>]+>)\.?$/i;
const ENUMS = {
  work_type: new Set(["Epic", "Capability", "Task", "Bug", "Docs", "Automation", "Refactor"]),
  phase: new Set(["Discovery", "Planning", "Design", "Foundation", "MVP", "Stabilization", "Production", "Growth"]),
  size: new Set(["XS", "S", "M", "L", "XL"]),
  risk: new Set(["Low", "Medium", "High"]),
  qa_required: new Set(["Yes", "No"]),
};

function hasRealValue(value) {
  return typeof value === "string" && value.trim().length > 0 && !PLACEHOLDER_VALUE.test(value.trim());
}

function acceptanceItemCount(value = "") {
  return value.split("\n").filter((line) => /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/.test(line)).length;
}

function parseIssueForm(body = "") {
  const fields = {};
  const headings = [...body.matchAll(/^###\s+(.+?)\s*$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const key = FIELD_NAMES[match[1].trim()];
    const start = match.index + match[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    if (key) fields[key] = body.slice(start, end).trim();
  }
  return fields;
}

function auditIssueBody({ body = "", labels = [], hasSubIssues = false, leafStateKnown = true }) {
  const fields = parseIssueForm(body);
  const reasons = [];
  for (const [label, key] of Object.entries(FIELD_NAMES)) {
    if (!hasRealValue(fields[key])) reasons.push(`Missing or placeholder value: ${label}.`);
  }
  for (const [key, values] of Object.entries(ENUMS)) {
    if (hasRealValue(fields[key]) && !values.has(fields[key])) {
      reasons.push(`Invalid ${key.replaceAll("_", " ")} value: ${fields[key]}.`);
    }
  }
  if (hasRealValue(fields.acceptance)) {
    const count = acceptanceItemCount(fields.acceptance);
    if (count < 3 || count > 5) reasons.push("Acceptance Criteria must contain three to five list items.");
  }
  if (new Set(["Epic", "Capability"]).has(fields.work_type)) {
    reasons.push("Epic and Capability issues cannot be agent-ready.");
  }
  if (new Set(["L", "XL"]).has(fields.size)) {
    reasons.push("L and XL issues must be decomposed before agent-ready.");
  }
  if (!leafStateKnown) reasons.push("Native sub-issue state could not be verified; readiness fails closed.");
  if (hasSubIssues) reasons.push("Only leaf issues can be agent-ready.");
  if (labels.includes("blocked")) reasons.push("Issue has the blocked label.");
  return { ready: reasons.length === 0, reasons };
}

module.exports = { acceptanceItemCount, auditIssueBody, hasRealValue, parseIssueForm };
