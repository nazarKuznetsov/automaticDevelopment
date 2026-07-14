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
  "plan_item_id",
  "goal",
  "merge_outcome",
  "acceptance",
  "validation",
  "integration_validation",
  "integration_order",
  "primary_signal",
  "owner_layer",
  "conflict_keys",
  "touch_points",
  "reviewers",
  "out_of_scope",
  "priority",
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

function hasStringList(value, { min = 1, max = Number.POSITIVE_INFINITY } = {}) {
  return Array.isArray(value)
    && value.length >= min
    && value.length <= max
    && value.every(hasText);
}

const CONFLICT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validConflictKeys(value) {
  return hasStringList(value)
    && value.every((key) => CONFLICT_KEY_PATTERN.test(key))
    && new Set(value).size === value.length;
}

function slug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function planItemId(phase, candidate) {
  if (hasText(candidate.plan_item_id)) return candidate.plan_item_id;
  const stablePart = slug(candidate.title ?? candidate.id);
  return stablePart ? `${slug(phase)}.${stablePart}` : "";
}

function mergeUnitReasons(candidate) {
  const reasons = [];
  const requiredText = ["parent_plan_item_id", "merge_outcome", "primary_signal", "owner_layer"];
  const requiredLists = ["conflict_keys", "touch_points", "reviewers", "human_gates", "out_of_scope"];
  for (const field of requiredText) {
    if (!hasText(candidate[field])) reasons.push(`Missing ${field}.`);
  }
  for (const field of requiredLists) {
    if (!hasStringList(candidate[field])) reasons.push(`Missing ${field}.`);
  }
  if (!validConflictKeys(candidate.conflict_keys)) reasons.push("conflict_keys must be unique lowercase kebab-case values.");
  if (!hasStringList(candidate.acceptance, { min: 3, max: 5 })) reasons.push("Acceptance must contain three to five criteria.");
  for (const scope of ["targeted", "full", "integration"]) {
    if (!hasStringList(candidate.validation?.[scope])) reasons.push(`Missing validation.${scope}.`);
  }
  if (!Number.isInteger(candidate.integration_order) || candidate.integration_order < 1) reasons.push("Missing integration_order.");
  return reasons;
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
  const candidates = (current.candidates ?? [])
    .filter((issue) => issue.is_leaf && !issue.blocked && !new Set(["L", "XL"]).has(issue.size))
    .map((issue) => ({ ...issue, plan_item_id: planItemId(current_phase, issue) }));
  const rejectedCandidates = [];
  const validCandidates = [];
  const identifiers = new Set();
  for (const candidate of candidates) {
    const reasons = mergeUnitReasons(candidate);
    if (!hasText(candidate.plan_item_id)) reasons.push("Missing stable plan_item_id.");
    if (identifiers.has(candidate.plan_item_id)) reasons.push(`Duplicate plan_item_id: ${candidate.plan_item_id}.`);
    if (reasons.length > 0) rejectedCandidates.push({ ...candidate, reasons });
    else {
      identifiers.add(candidate.plan_item_id);
      validCandidates.push(candidate);
    }
  }
  const currentWave = validCandidates
    .sort((left, right) => {
      const priorities = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (priorities[left.priority] ?? 4) - (priorities[right.priority] ?? 4)
        || left.integration_order - right.integration_order;
    })
    .slice(0, Math.min(wave_limit, 5));

  return { phases: normalized, current_wave: currentWave, rejected_candidates: rejectedCandidates };
}

export function materializeApprovedPlan(packet, ledger = {}) {
  if (packet?.approval?.status !== "APPROVED"
    || !hasText(packet.approval?.revision)
    || packet.approval.revision !== packet.revision) {
    throw new Error("Plan materialization requires an approved, revision-bound Phase Plan Packet.");
  }
  const itemMap = new Map();
  for (const item of [...(packet.hierarchy ?? []), ...(packet.ready_wave ?? [])]) {
    if (!hasText(item.plan_item_id)) throw new Error("Every materialized item requires plan_item_id.");
    itemMap.set(item.plan_item_id, { ...(itemMap.get(item.plan_item_id) ?? {}), ...item });
  }
  const items = [...itemMap.values()];
  const hierarchyIds = (packet.hierarchy ?? []).map((item) => item.plan_item_id);
  if (new Set(hierarchyIds).size !== hierarchyIds.length) throw new Error("Duplicate plan_item_id in Phase Plan hierarchy.");
  const mapping = ledger.mapping ?? {};
  const resolvedPlanItems = new Set(ledger.resolved_plan_items ?? []);
  const relationships = new Set(ledger.relationships ?? []);
  const byId = new Map(items.map((item) => [item.plan_item_id, item]));
  for (const ready of packet.ready_wave ?? []) {
    const hierarchyItem = (packet.hierarchy ?? []).find((item) => item.plan_item_id === ready.plan_item_id);
    if (!hierarchyItem || !hasText(hierarchyItem.parent_plan_item_id)) {
      throw new Error(`Ready leaf ${ready.plan_item_id} must appear in hierarchy with a valid parent_plan_item_id.`);
    }
    if (ready.parent_plan_item_id !== hierarchyItem.parent_plan_item_id) {
      throw new Error(`Ready leaf ${ready.plan_item_id} parent does not match the approved hierarchy.`);
    }
    const unresolved = (packet.dependencies ?? [])
      .filter((dependency) => dependency.blocked === ready.plan_item_id && !resolvedPlanItems.has(dependency.blocking));
    if (unresolved.length > 0) {
      throw new Error(`Ready leaf ${ready.plan_item_id} has unresolved dependencies and cannot receive agent-ready.`);
    }
  }
  for (const item of packet.hierarchy ?? []) {
    if (item.parent_plan_item_id && !byId.has(item.parent_plan_item_id) && !mapping[item.parent_plan_item_id]) {
      throw new Error(`Unknown parent plan item: ${item.parent_plan_item_id}.`);
    }
  }
  for (const dependency of packet.dependencies ?? []) {
    for (const id of [dependency.blocking, dependency.blocked]) {
      if (!byId.has(id) && !mapping[id]) throw new Error(`Unknown dependency plan item: ${id}.`);
    }
  }
  const depth = (item, seen = new Set()) => {
    if (!item?.parent_plan_item_id) return 0;
    if (seen.has(item.plan_item_id)) throw new Error(`Cyclic plan hierarchy at ${item.plan_item_id}.`);
    const parent = byId.get(item.parent_plan_item_id);
    return parent ? 1 + depth(parent, new Set([...seen, item.plan_item_id])) : 1;
  };
  const issueCreates = items
    .filter((item) => hasText(item.plan_item_id) && !mapping[item.plan_item_id])
    .sort((left, right) => depth(left) - depth(right));
  const relationshipCreates = [];
  for (const item of items) {
    if (!item.parent_plan_item_id) continue;
    const key = `parent:${item.parent_plan_item_id}>${item.plan_item_id}`;
    if (!relationships.has(key)) relationshipCreates.push({ kind: "parent", key, parent: item.parent_plan_item_id, child: item.plan_item_id });
  }
  for (const dependency of packet.dependencies ?? []) {
    const key = `dependency:${dependency.blocking}>${dependency.blocked}`;
    if (!relationships.has(key)) relationshipCreates.push({ kind: "dependency", key, ...dependency });
  }
  return {
    approval_revision: packet.approval.revision,
    issue_creates: issueCreates,
    relationship_creates: relationshipCreates,
    requires_read_after_write: true,
    agent_ready_candidates: (packet.ready_wave ?? []).map((item) => item.plan_item_id),
  };
}

export function evaluateMaterializationReport(packet, report) {
  const blockers = [];
  const observed = (records, key) => new Set((records ?? []).filter((item) => item.observed === true).map(key));
  const validIssueUrl = (value) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(value ?? "");
  const mappingRecords = (report.mapping ?? []).filter((item) => Number.isInteger(item.issue_number) && item.issue_number > 0 && validIssueUrl(item.issue_url));
  const mapping = new Set(mappingRecords.map((item) => item.plan_item_id));
  const expectedItems = new Set((packet.hierarchy ?? []).map((item) => item.plan_item_id));
  for (const id of expectedItems) if (!mapping.has(id)) blockers.push(`Missing Issue mapping for ${id}.`);
  for (const id of mapping) if (!expectedItems.has(id)) blockers.push(`Unexpected Issue mapping for ${id}.`);
  if (mappingRecords.length !== (report.mapping ?? []).length || mapping.size !== mappingRecords.length) blockers.push("Issue mapping contains invalid or duplicate evidence.");

  const expectedHierarchy = new Set((packet.hierarchy ?? [])
    .filter((item) => item.parent_plan_item_id)
    .map((item) => `${item.parent_plan_item_id}>${item.plan_item_id}`));
  const actualHierarchy = observed(report.hierarchy_readback, (item) => `${item.parent_plan_item_id}>${item.child_plan_item_id}`);
  for (const edge of expectedHierarchy) if (!actualHierarchy.has(edge)) blockers.push(`Missing hierarchy readback for ${edge}.`);
  for (const edge of actualHierarchy) if (!expectedHierarchy.has(edge)) blockers.push(`Unexpected hierarchy readback for ${edge}.`);

  const expectedDependencies = new Set((packet.dependencies ?? []).map((item) => `${item.blocking}>${item.blocked}`));
  const actualDependencies = observed(report.dependency_readback, (item) => `${item.blocking}>${item.blocked}`);
  for (const edge of expectedDependencies) if (!actualDependencies.has(edge)) blockers.push(`Missing dependency readback for ${edge}.`);
  for (const edge of actualDependencies) if (!expectedDependencies.has(edge)) blockers.push(`Unexpected dependency readback for ${edge}.`);

  const projectItems = observed((report.project_readback ?? []).filter((item) => hasText(item.project_item_id) && new Set(["Backlog", "Ready"]).has(item.status)), (item) => item.plan_item_id);
  for (const id of expectedItems) if (!projectItems.has(id)) blockers.push(`Missing Project readback for ${id}.`);
  for (const id of projectItems) if (!expectedItems.has(id)) blockers.push(`Unexpected Project readback for ${id}.`);
  const readyItems = new Set((report.agent_ready_readback ?? [])
    .filter((item) => item.label_present === true && item.status === "Ready" && validIssueUrl(item.issue_url))
    .map((item) => item.plan_item_id));
  const expectedReady = new Set((packet.ready_wave ?? []).map((item) => item.plan_item_id));
  for (const id of expectedReady) if (!readyItems.has(id)) blockers.push(`Missing agent-ready readback for ${id}.`);
  for (const id of readyItems) if (!expectedReady.has(id)) blockers.push(`Unexpected agent-ready readback for ${id}.`);
  if (report.phase_plan_revision !== packet.revision) blockers.push("Materialization report revision does not match the approved Phase Plan.");
  if (report.status !== "PASS") blockers.push("Materialization did not PASS.", ...(report.blockers ?? []));
  return { valid: blockers.length === 0, blockers };
}

export function selectLaunchableIssues({ candidates = [], active_workers = [], max_workers = 2 }) {
  const selected = [];
  const deferred = [];
  const occupiedKeys = new Set(active_workers.flatMap((worker) => (worker.conflict_keys ?? []).map(slug)));
  const slots = Math.max(0, max_workers - active_workers.length);
  for (const candidate of candidates) {
    let reason = null;
    if (candidate.ready !== true || candidate.blocked === true || candidate.is_leaf !== true || new Set(["L", "XL"]).has(candidate.size)) {
      reason = "NOT_EXECUTABLE_LEAF";
    } else if (!validConflictKeys(candidate.conflict_keys)) {
      reason = "MALFORMED_CONFLICT_KEYS";
    } else if (candidate.conflict_keys.map(slug).some((key) => occupiedKeys.has(key))) {
      reason = "CONFLICT_KEY_OVERLAP";
    } else if (selected.length >= slots) {
      reason = "CAPACITY";
    }
    if (reason) deferred.push({ ...candidate, reason });
    else {
      selected.push(candidate);
      for (const key of candidate.conflict_keys.map(slug)) occupiedKeys.add(key);
    }
  }
  return { selected, deferred };
}

export function evaluateWorkerLaunch({ result = {} }) {
  if (result.status === "QUEUED") {
    return { state: "CREATING", count_launch: false, keep_claim: true, next_action: "VERIFY_CANONICAL_TASK" };
  }
  if (result.status === "AMBIGUOUS") {
    return { state: "UNKNOWN", count_launch: false, keep_claim: true, next_action: "QUERY_BEFORE_RETRY" };
  }
  if (result.status === "FAILED") {
    return { state: "FAILED", count_launch: false, keep_claim: false, next_action: "RELEASE_CLAIM" };
  }
  if (result.status !== "CREATED") {
    return { state: "REJECTED", count_launch: false, keep_claim: false, next_action: "RELEASE_CLAIM" };
  }
  const temporaryPath = hasText(result.worktree_path) && /^\/(?:private\/)?tmp(?:\/|$)/.test(result.worktree_path);
  const taskVerified = hasText(result.task_id)
    && result.task_readback?.id === result.task_id
    && result.task_readback?.kind === "top_level"
    && result.task_readback?.observed === true
    && result.task_readback?.source === "codex_task_readback"
    && new Set(["READY", "RUNNING"]).has(result.task_readback?.state);
  const worktreeVerified = hasText(result.worktree?.id)
    && result.worktree?.task_id === result.task_id
    && result.worktree?.managed === true
    && result.worktree?.observed === true
    && result.worktree?.source === "codex_worktree_readback"
    && result.worktree?.state === "READY";
  if (!taskVerified || !worktreeVerified || temporaryPath) {
    return { state: "REJECTED", count_launch: false, keep_claim: false, next_action: "RELEASE_CLAIM" };
  }
  return { state: "LAUNCHED", count_launch: true, keep_claim: true, next_action: "MONITOR" };
}

export function evaluateClaimStaleness({ task_found, missed_heartbeats = 0, branch_exists, pr_exists }) {
  const stale = task_found === false && missed_heartbeats >= 3 && branch_exists !== true && pr_exists !== true;
  return { stale, action: stale ? "RELEASE_AND_REQUEUE" : "KEEP_CLAIM" };
}

export function evaluateReviewTopology({ worker_id, agents = [] }) {
  const reasons = [];
  const active = agents.filter((agent) => agent.active === true);
  if (active.length > 2) reasons.push("A Worker may keep at most two active direct subagents.");
  if (agents.some((agent) => agent.depth !== 1)) reasons.push("Subagent depth must be exactly one.");
  if (agents.some((agent) => agent.tracked_writes === true)) reasons.push("Review and QA agents must not create tracked changes.");
  const identities = [worker_id, ...agents.map((agent) => agent.id)].filter(hasText);
  if (new Set(identities).size !== identities.length) reasons.push("Worker, reviewer, QA, and admission identities must be distinct.");
  const requiredRoles = ["reviewer", "qa", "admission-reviewer"];
  for (const role of requiredRoles) {
    if (!agents.some((agent) => agent.role === role)) reasons.push(`Missing ${role}.`);
  }
  return { valid: reasons.length === 0, reasons };
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

  const requiredEvidenceFields = [
    "schema_version", "packet_type", "commit_sha", "base_sha_at_launch", "validated_base_sha",
    "qa_tracked_worktree", "gate_tracked_worktree", "worker", "issue", "acceptance", "tdd",
    "local_validation", "reviews", "branch_ci", "baseline", "documentation", "rollout", "human_gates",
  ];
  requirePass(
    evidence.schema_version === 2
      && evidence.packet_type === "pre_pr_admission"
      && requiredEvidenceFields.every((field) => Object.hasOwn(evidence, field)),
    "Admission evidence does not satisfy the required packet shape for schema v2.",
  );
  requirePass(/^[0-9a-f]{40}$/.test(evidence.commit_sha ?? "") && evidence.commit_sha === evidence.current_sha, "Admission report is not bound to the full current commit SHA.");
  requirePass(
    /^[0-9a-f]{40}$/.test(evidence.base_sha_at_launch ?? "")
      && /^[0-9a-f]{40}$/.test(evidence.validated_base_sha ?? "")
      && evidence.validated_base_sha === evidence.current_base_sha,
    "The validated base is stale; synchronize and rerun validation, reviews, QA, CI, and admission while retaining base_sha_at_launch for traceability.",
  );
  requirePass(
    evidence.qa_tracked_worktree?.status === "CLEAN"
      && evidence.qa_tracked_worktree?.before === ""
      && evidence.qa_tracked_worktree?.after === "",
    "QA evidence must show an unchanged clean tracked worktree.",
  );
  requirePass(
    evidence.gate_tracked_worktree?.status === "CLEAN"
      && evidence.gate_tracked_worktree?.before === ""
      && evidence.gate_tracked_worktree?.after === "",
    "The deterministic gate must observe a clean tracked worktree before and after validation.",
  );
  requirePass(Number.isInteger(evidence.issue?.number) && evidence.issue.number > 0, "Admission evidence lacks a valid Issue number.");
  const branchPattern = Number.isInteger(evidence.issue?.number)
    ? new RegExp(`^agent/${evidence.issue.number}-[a-z0-9][a-z0-9-]*$`)
    : /^$/;
  requirePass(branchPattern.test(evidence.current_branch ?? ""), "Current branch does not match agent/<issue>-<slug>.");
  requirePass(evidence.issue?.is_leaf === true, "Only a leaf issue can enter admission.");
  requirePass(Array.isArray(evidence.issue?.unresolved_dependencies) && evidence.issue.unresolved_dependencies.length === 0, "Blocking issue dependencies remain unresolved or dependency evidence is missing.");
  const riskMetadataValid = new Set(["Low", "Medium", "High"]).has(evidence.issue?.risk)
    && Array.isArray(evidence.issue?.high_risk_flags)
    && new Set(evidence.issue.high_risk_flags).size === evidence.issue.high_risk_flags.length
    && evidence.issue.high_risk_flags.every((flag) => new Set(["security", "auth", "data", "migration"]).has(flag));
  requirePass(riskMetadataValid, "Issue risk and high-risk flags are missing or invalid.");
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
  requirePass(validationPassed(evidence.local_validation?.integration, evidence.current_sha, evidence.configured_validation?.integration), "Integration validation does not contain the exact configured commands and successful results for this SHA.");

  const workerSource = evidence.worker?.source;
  const reviewerPass = reviewPassed(evidence.reviews?.reviewer, evidence.current_sha, workerSource);
  const qaPass = reviewPassed(evidence.reviews?.qa, evidence.current_sha, workerSource);
  const admissionPass = reviewPassed(evidence.reviews?.admission, evidence.current_sha, workerSource);
  requirePass(reviewerPass, "Independent reviewer lacks a distinct identity, exact SHA, or traceable PASS evidence.");
  requirePass(qaPass, "Independent QA lacks a distinct identity, exact SHA, or traceable PASS evidence.");
  requirePass(admissionPass, "Admission reviewer lacks a distinct identity, exact SHA, or traceable PASS evidence.");
  requirePass(!reviewerPass || !qaPass || evidence.reviews.reviewer.source.id !== evidence.reviews.qa.source.id, "Reviewer and QA must be distinct evidence sources.");
  requirePass(
    !admissionPass
      || !reviewerPass
      || !qaPass
      || !new Set([evidence.reviews.reviewer.source.id, evidence.reviews.qa.source.id]).has(evidence.reviews.admission.source.id),
    "Admission reviewer must be distinct from Worker, reviewer, and QA.",
  );
  requirePass(conditionalReviewPassed(evidence.reviews?.design, evidence.current_sha, workerSource), "Design review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  requirePass(conditionalReviewPassed(evidence.reviews?.security, evidence.current_sha, workerSource), "Security review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  const highRisk = !riskMetadataValid || evidence.issue?.risk === "High"
    || (evidence.issue?.high_risk_flags ?? []).some((flag) => new Set(["security", "auth", "data", "migration"]).has(flag));
  if (highRisk) {
    requirePass(
      reviewPassed(evidence.reviews?.security, evidence.current_sha, workerSource)
        && new Set(["top_level_task", "human"]).has(evidence.reviews.security.source.scope),
      "High-risk work requires security evidence from a separate top-level review task or named human.",
    );
  }
  requirePass(
    evidence.branch_ci?.status === "PASS"
      && evidence.branch_ci?.commit_sha === evidence.current_sha
      && evidence.branch_ci?.workflow === evidence.configured_validation?.branch_ci_workflow
      && validRunUrl(evidence.branch_ci?.run_url),
    "Branch CI lacks a matching workflow run URL for the current commit SHA.",
  );

  const baselineShapeValid = Array.isArray(evidence.baseline?.new_failures)
    && Array.isArray(evidence.baseline?.affected_failures)
    && Array.isArray(evidence.baseline?.legacy_failures);
  requirePass(baselineShapeValid, "Baseline evidence is incomplete.");
  requirePass(Array.isArray(evidence.baseline?.new_failures) && evidence.baseline.new_failures.length === 0, "A new regression is present.");
  requirePass(Array.isArray(evidence.baseline?.affected_failures) && evidence.baseline.affected_failures.length === 0, "A touched legacy failure remains unresolved.");
  for (const failure of Array.isArray(evidence.baseline?.legacy_failures) ? evidence.baseline.legacy_failures : []) {
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

export function evaluateMerge({ now, authorization = {}, pr = {}, admission = {}, current_base_sha, unresolved_dependencies = [] }) {
  const blockers = [];
  const requirePass = (condition, message) => {
    if (!condition) blockers.push(message);
  };
  requirePass(authorization.status === "APPROVED", "Human merge authorization is missing.");
  requirePass(hasText(authorization.human_identity), "Human merge authorization lacks a named identity.");
  requirePass(validRunUrl(authorization.admission_report_url) || /^https:\/\/[^/]+\/.+/.test(authorization.admission_report_url ?? ""), "Human merge authorization lacks an admission report URL.");
  requirePass(hasText(authorization.repository) && authorization.repository === pr.repository, "Human authorization is not bound to this repository.");
  requirePass(Number.isInteger(authorization.pr) && authorization.pr === pr.number, "Human authorization is not bound to this PR.");
  requirePass(hasText(authorization.head_sha) && authorization.head_sha === pr.head_sha, "Human authorization is not bound to the exact head SHA.");
  requirePass(/^[0-9a-f]{40}$/.test(authorization.base_sha ?? "") && authorization.base_sha === current_base_sha, "Human authorization is not bound to the current base SHA.");
  requirePass(/^[0-9a-f]{64}$/.test(authorization.admission_report_digest ?? "") && authorization.admission_report_digest === admission.report_digest, "Human authorization is not bound to the exact admission report digest.");
  requirePass(hasText(authorization.valid_until) && hasText(now) && Date.parse(authorization.valid_until) > Date.parse(now), "Human merge authorization is missing, invalid, or expired.");
  requirePass(admission.status === "PASS" && admission.commit_sha === pr.head_sha && hasText(admission.source_id) && /^[0-9a-f]{64}$/.test(admission.report_digest ?? ""), "Fresh independent admission PASS is missing for the PR head SHA.");
  requirePass(admission.base_sha === current_base_sha, "The base branch advanced; synchronize and repeat CI, review, QA, admission, and human approval.");
  requirePass(pr.checks === "PASS", "Required PR checks are not passing.");
  requirePass(pr.unresolved_threads === 0, "Unresolved review threads remain.");
  requirePass(unresolved_dependencies.length === 0, "Blocking issue dependencies remain unresolved.");
  return {
    authorize_merge: blockers.length === 0,
    expected_head_sha: blockers.length === 0 ? pr.head_sha : null,
    blockers,
  };
}

export function postMergeReconciliation({ merge_readback = {}, post_merge_ci = {}, blocking_findings = [] }) {
  const mergeEvidenceValid = merge_readback.status === "MERGED"
    && Number.isInteger(merge_readback.pr)
    && /^[0-9a-f]{40}$/.test(merge_readback.head_sha ?? "")
    && /^[0-9a-f]{40}$/.test(merge_readback.merge_commit_sha ?? "")
    && /^https:\/\/[^/]+\/.+/.test(merge_readback.url ?? "");
  const ciEvidenceValid = post_merge_ci.status === "PASS"
    && post_merge_ci.commit_sha === merge_readback.merge_commit_sha
    && hasText(post_merge_ci.workflow)
    && validRunUrl(post_merge_ci.run_url);
  const complete = mergeEvidenceValid && ciEvidenceValid && blocking_findings.length === 0;
  return {
    issue_status: complete ? "Done" : "Review",
    archive_worker: complete,
    create_blocking_bug: mergeEvidenceValid && post_merge_ci.status === "FAIL",
  };
}

export const workflowConstants = Object.freeze({ phases: PHASES, required_ready_fields: REQUIRED_READY_FIELDS });
