const PHASES = [
  "Discovery",
  "Planning",
  "Design",
  "Foundation",
  "MVP",
  "Stabilization",
  "Production",
  "Growth",
];

const REQUIRED_READY_FIELDS = [
  "goal",
  "acceptance",
  "validation",
  "primary_signal",
  "risk",
  "size",
  "phase",
  "work_type",
  "qa_required",
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEvidence(items) {
  return Array.isArray(items) && items.length > 0 && items.every((item) => {
    return item && typeof item === "object" && hasText(item.source) && hasText(item.observed);
  });
}

function sameStringList(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validationPassed(record, sha, configuredCommands) {
  if (record?.status !== "PASS" || record?.commit_sha !== sha || !Array.isArray(record.commands)) return false;
  const commands = record.commands.map((item) => item?.command);
  return sameStringList(commands, configuredCommands)
    && record.commands.every((item) => hasText(item?.command) && item.exit_code === 0 && hasText(item.observed));
}

function reviewPassed(record, sha, workerSource) {
  return record?.status === "PASS"
    && record.commit_sha === sha
    && new Set(["agent_task", "human"]).has(record.source?.kind)
    && hasText(record.source?.id)
    && record.source.id !== workerSource?.id
    && hasEvidence(record.evidence);
}

function conditionalReviewPassed(record, sha, workerSource) {
  if (record?.status === "NOT_REQUIRED") return hasText(record.reason);
  return reviewPassed(record, sha, workerSource);
}

function validRunUrl(value) {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /\/actions\/runs\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

export function capabilityProfile(ownerType, verified = {}) {
  if (!new Set(["personal", "organization"]).has(ownerType)) {
    throw new Error(`Unknown repository owner type: ${ownerType}`);
  }

  return {
    issue_types: ownerType === "organization" && verified.issue_types === true,
    merge_queue: ownerType === "organization" && verified.merge_queue === true,
    work_type_fallback: true,
  };
}

export function evaluateReadiness({ fields = {}, has_sub_issues = false, unresolved_dependencies = [] }) {
  const reasons = [];

  for (const field of REQUIRED_READY_FIELDS) {
    if (!hasText(fields[field])) {
      reasons.push(`Missing required value: ${field}.`);
    }
  }

  if (has_sub_issues) {
    reasons.push("Only leaf issues can be agent-ready.");
  }

  if (new Set(["L", "XL"]).has(fields.size)) {
    reasons.push("L and XL issues must be decomposed before execution.");
  }

  if (unresolved_dependencies.length > 0) {
    reasons.push("Resolve native issue dependencies before Ready.");
  }

  return { ready: reasons.length === 0, reasons };
}

export function planRollingWave({ current_phase, phases, wave_limit = 5 }) {
  const currentIndex = PHASES.indexOf(current_phase);
  if (currentIndex === -1) {
    throw new Error(`Unknown current phase: ${current_phase}`);
  }

  const byName = new Map(phases.map((phase) => [phase.name, phase]));
  const normalized = PHASES.map((name, index) => {
    const source = byName.get(name) ?? { name, epics: [] };
    return {
      name,
      epics: source.epics ?? [],
      dependencies: source.dependencies ?? [],
      detail: index === currentIndex ? "executable" : index === currentIndex + 1 ? "draft" : "roadmap",
    };
  });

  const current = byName.get(current_phase) ?? {};
  const currentWave = (current.candidates ?? [])
    .filter((issue) => issue.is_leaf && !issue.blocked && !new Set(["L", "XL"]).has(issue.size))
    .sort((left, right) => {
      const priorities = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (priorities[left.priority] ?? 4) - (priorities[right.priority] ?? 4);
    })
    .slice(0, Math.min(wave_limit, 5));

  return { phases: normalized, current_wave: currentWave };
}

export function classifyFinding(finding) {
  if (Number.isInteger(finding.duplicate_issue) && finding.duplicate_issue > 0) {
    return { action: "LINK_DUPLICATE", issue: finding.duplicate_issue };
  }

  const highRisk = finding.severity === "High"
    || finding.security === true
    || finding.data_risk === true
    || finding.migration_risk === true
    || finding.product_ambiguity === true;

  if (highRisk) {
    return { action: "HUMAN_ACTION_REQUIRED" };
  }

  if (!new Set(["Low", "Medium"]).has(finding.severity)) {
    return { action: "REQUEST_EVIDENCE" };
  }

  if (finding.within_scope) {
    return { action: "RETURN_TO_WORKER" };
  }

  if (!finding.evidence_complete) {
    return { action: "REQUEST_EVIDENCE" };
  }

  return {
    action: "CREATE_BUG",
    block_parent: finding.affects_acceptance === true,
  };
}

function collectAdmissionBlockers(evidence) {
  const blockers = [];
  const requirePass = (condition, message) => {
    if (!condition) blockers.push(message);
  };

  requirePass(evidence.schema_version === 2 && evidence.packet_type === "pre_pr_admission", "Admission evidence does not match packet schema v2.");
  requirePass(/^[0-9a-f]{40}$/.test(evidence.commit_sha ?? "") && evidence.commit_sha === evidence.current_sha, "Admission report is not bound to the full current commit SHA.");
  requirePass(Number.isInteger(evidence.issue?.number) && evidence.issue.number > 0, "Admission evidence lacks a valid Issue number.");
  const branchPattern = Number.isInteger(evidence.issue?.number)
    ? new RegExp(`^agent/${evidence.issue.number}-[a-z0-9][a-z0-9-]*$`)
    : /^$/;
  requirePass(branchPattern.test(evidence.current_branch ?? ""), "Current branch does not match agent/<issue>-<slug>.");
  requirePass(evidence.issue?.is_leaf === true, "Only a leaf issue can enter admission.");
  requirePass((evidence.issue?.unresolved_dependencies ?? []).length === 0, "Blocking issue dependencies remain unresolved.");
  requirePass(new Set(["agent_task", "human"]).has(evidence.worker?.source?.kind) && hasText(evidence.worker?.source?.id), "Worker identity is missing.");
  requirePass(evidence.acceptance?.passed === true && hasEvidence(evidence.acceptance?.evidence), "Acceptance criteria lack traceable passing evidence.");

  const tddPass = evidence.tdd?.status === "PASS"
    && hasText(evidence.tdd?.red?.command)
    && Number.isInteger(evidence.tdd?.red?.exit_code)
    && evidence.tdd.red.exit_code !== 0
    && hasText(evidence.tdd?.red?.observed)
    && hasText(evidence.tdd?.green?.command)
    && Number.isInteger(evidence.tdd?.green?.exit_code)
    && evidence.tdd.green.exit_code === 0
    && hasText(evidence.tdd?.green?.observed);
  const exemption = evidence.tdd?.status === "EXEMPT"
    && new Set(["docs", "config"]).has(evidence.tdd?.exemption_type)
    && hasText(evidence.tdd?.reason);
  requirePass(tddPass || exemption, "TDD RED/GREEN evidence or an allowed exemption is missing.");

  requirePass(validationPassed(evidence.local_validation?.targeted, evidence.current_sha, evidence.configured_validation?.targeted), "Targeted local validation does not contain the exact configured commands and successful results for this SHA.");
  requirePass(validationPassed(evidence.local_validation?.full, evidence.current_sha, evidence.configured_validation?.full), "Full local validation does not contain the exact configured commands and successful results for this SHA.");

  const workerSource = evidence.worker?.source;
  const reviewerPass = reviewPassed(evidence.reviews?.reviewer, evidence.current_sha, workerSource);
  const qaPass = reviewPassed(evidence.reviews?.qa, evidence.current_sha, workerSource);
  requirePass(reviewerPass, "Independent reviewer lacks a distinct identity, exact SHA, or traceable PASS evidence.");
  requirePass(qaPass, "Independent QA lacks a distinct identity, exact SHA, or traceable PASS evidence.");
  requirePass(!reviewerPass || !qaPass || evidence.reviews.reviewer.source.id !== evidence.reviews.qa.source.id, "Reviewer and QA must be distinct evidence sources.");
  requirePass(conditionalReviewPassed(evidence.reviews?.design, evidence.current_sha, workerSource), "Design review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  requirePass(conditionalReviewPassed(evidence.reviews?.security, evidence.current_sha, workerSource), "Security review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  requirePass(
    evidence.branch_ci?.status === "PASS"
      && evidence.branch_ci?.commit_sha === evidence.current_sha
      && evidence.branch_ci?.workflow === evidence.configured_validation?.branch_ci_workflow
      && validRunUrl(evidence.branch_ci?.run_url),
    "Branch CI lacks a matching workflow run URL for the current commit SHA.",
  );

  requirePass((evidence.baseline?.new_failures ?? []).length === 0, "A new regression is present.");
  requirePass((evidence.baseline?.affected_failures ?? []).length === 0, "A touched legacy failure remains unresolved.");
  for (const failure of evidence.baseline?.legacy_failures ?? []) {
    requirePass(
      Number.isInteger(failure.issue)
        && failure.issue > 0
        && failure.proven_pre_existing === true
        && hasText(failure.base_sha)
        && hasEvidence(failure.evidence),
      `Legacy failure is not covered by a traceable baseline Bug: ${failure.signal ?? "unknown"}.`,
    );
  }

  requirePass(evidence.documentation?.status === "PASS" ? hasEvidence(evidence.documentation?.evidence) : evidence.documentation?.status === "NOT_REQUIRED" && hasText(evidence.documentation?.reason), "Documentation impact is unresolved or lacks evidence/reason.");
  requirePass(evidence.rollout?.status === "PASS" ? hasEvidence(evidence.rollout?.evidence) : evidence.rollout?.status === "NOT_REQUIRED" && hasText(evidence.rollout?.reason), "Migration or rollout impact is unresolved or lacks evidence/reason.");
  requirePass(evidence.human_gates?.status === "CLEAR" && hasText(evidence.human_gates?.reason), "Human gates are not explicitly clear for this SHA.");
  if (evidence.existing_pr_for_sha !== undefined) {
    requirePass(
      Number.isInteger(evidence.existing_pr_for_sha?.number)
        && evidence.existing_pr_for_sha.number > 0
        && hasText(evidence.existing_pr_for_sha?.url)
        && evidence.existing_pr_for_sha.commit_sha === evidence.current_sha,
      "Existing PR evidence lacks a canonical number, URL, or matching SHA.",
    );
  }

  return blockers;
}

export function evaluateAdmission(evidence) {
  if (evidence.human_gates?.status === "BLOCKED") {
    return {
      status: "BLOCKED",
      issue_status: "Blocked",
      authorize_pr: false,
      pr_action: "NONE",
      commit_sha: evidence.commit_sha,
      blockers: [evidence.human_gates.reason ?? "Human action is required."],
    };
  }

  const blockers = collectAdmissionBlockers(evidence);
  if (blockers.length > 0) {
    return {
      status: "FAIL",
      issue_status: "Validation",
      authorize_pr: false,
      pr_action: "NONE",
      commit_sha: evidence.commit_sha,
      blockers,
    };
  }

  if (evidence.existing_pr_for_sha) {
    return {
      status: "PASS",
      issue_status: "Review",
      authorize_pr: false,
      pr_action: "USE_EXISTING",
      existing_pr: evidence.existing_pr_for_sha,
      commit_sha: evidence.commit_sha,
      blockers: [],
    };
  }

  return {
    status: "PASS",
    issue_status: "Validation",
    authorize_pr: true,
    pr_action: "CREATE_ONCE",
    commit_sha: evidence.commit_sha,
    blockers: [],
  };
}

export function postPrRecovery({ pr, signal }) {
  if (!new Set(["CHECK_FAILURE", "REQUESTED_CHANGES"]).has(signal)) {
    throw new Error(`Unsupported post-PR signal: ${signal}`);
  }
  return {
    pr,
    convert_to_draft: true,
    issue_status: "In Progress",
    reuse_branch_and_pr: true,
  };
}

export function orchestratorControl({ queue_length, awaiting_human, launches }) {
  return {
    heartbeat: queue_length > 0 && !awaiting_human ? "ACTIVE" : "PAUSE",
    handoff: launches >= 5 ? "REQUIRED" : "NOT_REQUIRED",
  };
}

export const workflowConstants = Object.freeze({ phases: PHASES, required_ready_fields: REQUIRED_READY_FIELDS });
