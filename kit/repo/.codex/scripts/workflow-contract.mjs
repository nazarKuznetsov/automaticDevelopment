import { createHash } from "node:crypto";

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

const RAW_ADMISSION_FIELDS = new Set([
  "schema_version", "packet_type", "commit_sha", "base_sha_at_launch", "validated_base_sha",
  "automation_profile",
  "qa_tracked_worktree", "gate_tracked_worktree", "worker", "executor", "publisher", "issue",
  "bootstrap", "canonical_publication", "acceptance", "tdd", "local_validation", "reviews",
  "branch_ci", "baseline", "documentation", "rollout", "human_gates", "existing_pr_for_sha",
]);

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
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const PLAN_ITEM_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const PROJECT_FIELDS = ["phase", "work_type", "priority", "size", "risk", "qa_required", "status"];
const MATERIALIZATION_STATUSES = new Set(["Backlog", "Ready"]);
const PROJECT_FIELD_VALUES = {
  phase: new Set(PHASES),
  work_type: new Set(["Epic", "Capability", "Task", "Bug", "Docs", "Automation", "Refactor"]),
  priority: new Set(["P0", "P1", "P2", "P3"]),
  size: new Set(["XS", "S", "M", "L", "XL"]),
  risk: new Set(["Low", "Medium", "High"]),
  qa_required: new Set(["Yes", "No"]),
  status: MATERIALIZATION_STATUSES,
};

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const AUTOMATION_PROFILES = Object.freeze({
  solo_fast: Object.freeze({
    profile: "solo_fast",
    automatic_github_writes: true,
    automatic_worker_launches: true,
    automatic_low_risk_merge: true,
    medium_high_exact_merge_authorization: true,
  }),
  team_safe: Object.freeze({
    profile: "team_safe",
    automatic_github_writes: true,
    automatic_worker_launches: true,
    automatic_low_risk_merge: false,
    medium_high_exact_merge_authorization: true,
  }),
  regulated: Object.freeze({
    profile: "regulated",
    automatic_github_writes: false,
    automatic_worker_launches: false,
    automatic_low_risk_merge: false,
    medium_high_exact_merge_authorization: true,
  }),
});
const PROJECT_STATUS_ORDER = Object.freeze([
  "Backlog",
  "Ready",
  "In Progress",
  "Validation",
  "Review",
  "Done",
]);

function validConflictKeys(value) {
  return hasStringList(value)
    && value.every((key) => CONFLICT_KEY_PATTERN.test(key))
    && new Set(value).size === value.length;
}

export function evaluateRepositoryIdentity(identity = {}) {
  const fields = [
    "config_repository",
    "remote_repository",
    "packet_repository",
    "issue_repository",
  ];
  const blockers = [];
  const repository = identity.config_repository;
  for (const field of fields) {
    const value = identity[field];
    if (!REPOSITORY_PATTERN.test(value ?? "")) {
      blockers.push(`${field} must contain an exact owner/repository identity.`);
    } else if (hasText(repository) && value !== repository) {
      blockers.push(`${field} does not match config_repository ${repository}.`);
    }
  }
  return {
    valid: blockers.length === 0,
    repository: blockers.length === 0 ? repository : undefined,
    blockers: [...new Set(blockers)],
  };
}

function normalizeWorkflowPath(value) {
  const path = String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = path.split("/");
  if (!path
    || path.startsWith("/")
    || /^[A-Za-z]:\//.test(path)
    || segments.some((segment) => !segment || new Set([".", "..", ".git"]).has(segment))) {
    return "";
  }
  return path;
}

export function classifyTouchOwnership({
  touch_points = [],
  manifest_files = [],
  declared_ownership = {},
} = {}) {
  const blockers = [];
  const ownershipByPath = new Map(
    manifest_files.map((entry) => [
      normalizeWorkflowPath(entry?.path),
      entry?.ownership,
    ]),
  );
  const declaredByPath = new Map();
  for (const ownership of ["managed", "host", "generated", "unknown"]) {
    for (const rawPath of declared_ownership?.[ownership] ?? []) {
      const path = normalizeWorkflowPath(rawPath);
      if (!path) {
        blockers.push(`Declared ${ownership} touch point is not a safe repository-relative path: ${rawPath}.`);
        continue;
      }
      const previous = declaredByPath.get(path);
      if (previous && previous !== ownership) {
        blockers.push(`Touch point ${path} has conflicting declared ownership: ${previous} and ${ownership}.`);
      } else {
        declaredByPath.set(path, ownership);
      }
    }
  }
  const result = {
    managed: [],
    host: [],
    generated: [],
    unknown: [],
  };
  for (const rawPath of touch_points) {
    const path = normalizeWorkflowPath(rawPath);
    if (!path) {
      blockers.push(`Touch point is not a safe repository-relative path: ${rawPath}.`);
      result.unknown.push(String(rawPath ?? ""));
      continue;
    }
    const manifestOwnership = ownershipByPath.get(path);
    const declaredOwnership = declaredByPath.get(path);
    if (manifestOwnership && declaredOwnership && manifestOwnership !== declaredOwnership) {
      blockers.push(`Touch point ${path} conflicts with manifest ownership ${manifestOwnership}.`);
    }
    if (!manifestOwnership && declaredOwnership === "managed") {
      blockers.push(`Touch point ${path} cannot be declared managed without a manifest entry.`);
    }
    const ownership = manifestOwnership ?? declaredOwnership;
    if (ownership === "managed") result.managed.push(path);
    else if (ownership === "host") result.host.push(path);
    else if (ownership === "generated") result.generated.push(path);
    else result.unknown.push(path);
  }
  const touchPointSet = new Set(touch_points.map(normalizeWorkflowPath).filter(Boolean));
  for (const path of declaredByPath.keys()) {
    if (!touchPointSet.has(path)) blockers.push(`Declared ownership contains a path outside touch_points: ${path}.`);
  }
  for (const key of Object.keys(result)) result[key] = [...new Set(result[key])].sort();
  const populated = ["managed", "host", "generated"].filter((key) => result[key].length > 0);
  const scope = populated.length > 1 ? "mixed" : (populated[0] ?? "unknown");
  return {
    valid: blockers.length === 0 && result.unknown.length === 0 && touch_points.length > 0,
    scope,
    blockers: [...new Set(blockers)],
    ...result,
  };
}

export function routeManagedChange({
  classification = {},
  policy = "block_and_report",
  source_access = false,
  source_repository,
  target_repository,
  source_issue = {},
  summary,
} = {}) {
  const managedPaths = [...new Set(classification.managed ?? [])].sort();
  if (managedPaths.length === 0) {
    return { action: "TARGET_WORKER", launch_target_worker: classification.valid === true };
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({
    managed_paths: managedPaths,
    source_repository,
    summary,
  })).digest("hex");
  const maintenancePacket = {
    schema_version: 2,
    packet_type: "kit_maintenance",
    fingerprint,
    repository: source_repository,
    target_repository,
    source_issue,
    summary,
    managed_paths: managedPaths,
    target_adoption: {
      host_paths: [...new Set(classification.host ?? [])].sort(),
      generated_paths: [...new Set(classification.generated ?? [])].sort(),
    },
    adoption_required: true,
  };
  const canRoute = policy === "route_to_source"
    && source_access === true
    && REPOSITORY_PATTERN.test(source_repository ?? "")
    && source_repository !== target_repository;
  return {
    action: canRoute ? "AUTO_ROUTE" : "BLOCK_AND_REPORT",
    launch_target_worker: false,
    maintenance_packet: maintenancePacket,
  };
}

export function evaluateWorkerPreflight({
  worker_packet = {},
  manifest_files = [],
  source_access = false,
  worker_launches = 0,
  github_writes = 0,
  now = new Date().toISOString(),
} = {}) {
  const identity = evaluateRepositoryIdentity(worker_packet.repository_identity);
  const classification = classifyTouchOwnership({
    touch_points: worker_packet.touch_points,
    manifest_files,
    declared_ownership: worker_packet.touch_ownership,
  });
  const blockers = [...identity.blockers, ...classification.blockers];
  if (worker_packet.repository !== identity.repository) {
    blockers.push("Worker Packet top-level repository does not match repository identity.");
  }
  if (worker_packet.touch_ownership?.scope !== classification.scope) {
    blockers.push(`Worker Packet touch_ownership scope does not match computed ${classification.scope} scope.`);
  }
  for (const ownership of ["managed", "host", "generated", "unknown"]) {
    const declared = [...new Set((worker_packet.touch_ownership?.[ownership] ?? [])
      .map(normalizeWorkflowPath).filter(Boolean))].sort();
    if (!sameStringList(declared, classification[ownership])) {
      blockers.push(`Worker Packet ${ownership} ownership partition does not match computed touch points.`);
    }
  }
  const allowedPaths = new Set((worker_packet.allowed_paths ?? []).map(normalizeWorkflowPath).filter(Boolean));
  for (const rawPath of worker_packet.touch_points ?? []) {
    const path = normalizeWorkflowPath(rawPath);
    if (!allowedPaths.has(path)) blockers.push(`Touch point is outside allowed_paths: ${path}.`);
  }
  const sourceRepository = worker_packet.kit_source_binding?.source_repository;
  if (!REPOSITORY_PATTERN.test(sourceRepository ?? "")
    || sourceRepository === identity.repository
    || !/^[0-9a-f]{40}$/.test(worker_packet.kit_source_binding?.source_commit ?? "")) {
    blockers.push("Worker Packet requires a distinct exact-SHA kit source binding.");
  }
  if (classification.unknown.length > 0) blockers.push(`Touch points have unknown ownership: ${classification.unknown.join(", ")}.`);
  if (blockers.length > 0) {
    return {
      action: "BLOCKED",
      launch_target_worker: false,
      blockers: [...new Set(blockers)],
      classification,
    };
  }
  const leaseAction = classification.managed.length > 0 ? "create_source_maintenance" : "create_worker";
  const leaseRepository = classification.managed.length > 0 ? sourceRepository : identity.repository;
  const leaseResult = evaluateAuthorityLease(worker_packet.authority_lease, {
    repository: leaseRepository,
    plan_revision: worker_packet.authority_lease?.plan_revision,
    plan_item_id: worker_packet.plan_item_id,
    issue_id: worker_packet.issue,
    action: leaseAction,
    worker_launches,
    github_writes,
  }, { now });
  if (!leaseResult.valid) {
    return {
      action: "BLOCKED",
      launch_target_worker: false,
      blockers: leaseResult.blockers,
      classification,
    };
  }
  if (classification.generated.length > 0) {
    return {
      action: "GENERATOR_REQUIRED",
      launch_target_worker: false,
      blockers: [],
      classification,
    };
  }
  if (classification.managed.length > 0) {
    const routing = routeManagedChange({
      classification,
      policy: worker_packet.managed_change_policy,
      source_access,
      source_repository: sourceRepository,
      target_repository: identity.repository,
      source_issue: { repository: identity.repository, number: worker_packet.issue },
      summary: worker_packet.summary ?? worker_packet.merge_outcome,
    });
    return {
      action: "SOURCE_REPAIR_REQUIRED",
      launch_target_worker: false,
      blockers: [],
      classification,
      routing,
    };
  }
  return {
    action: "ALLOW_TARGET_WORKER",
    launch_target_worker: true,
    blockers: [],
    classification,
  };
}

function exactRepositoryUrl(url, repository, resource) {
  if (!hasText(url) || !REPOSITORY_PATTERN.test(repository ?? "")) return false;
  const suffix = resource === "issue" ? "issues" : "pull";
  return new RegExp(`^https://github\\.com/${repository.replace("/", "\\/")}/${suffix}/[1-9][0-9]*$`).test(url);
}

export function evaluateSourceMaintenanceProgress({
  routing = {},
  duplicate_search = {},
  source_issue = {},
  source_worker = {},
  source_pr = {},
  target_installation = {},
  target_regression = {},
  wave_resume = {},
} = {}) {
  if (routing.action !== "AUTO_ROUTE") {
    return {
      status: "BLOCKED",
      next_action: "BLOCK_AND_REPORT",
      blockers: ["Source maintenance is not authorized for automatic routing."],
    };
  }
  const packet = routing.maintenance_packet ?? {};
  const blockers = [];
  if (!REPOSITORY_PATTERN.test(packet.repository ?? "")
    || !REPOSITORY_PATTERN.test(packet.target_repository ?? "")
    || packet.repository === packet.target_repository
    || !DIGEST_PATTERN.test(packet.fingerprint ?? "")
    || !hasStringList(packet.managed_paths)) {
    blockers.push("Kit Maintenance Packet has invalid source/target/fingerprint/path binding.");
  }
  if (blockers.length > 0) return { status: "BLOCKED", next_action: "BLOCK_AND_REPORT", blockers };
  if (duplicate_search.observed !== true) {
    return { status: "ACTIVE", next_action: "SEARCH_SOURCE_WORK", blockers: [] };
  }

  const duplicateIssue = duplicate_search.issue_url;
  const duplicatePr = duplicate_search.pr_url;
  if (duplicateIssue && !exactRepositoryUrl(duplicateIssue, packet.repository, "issue")) {
    return { status: "BLOCKED", next_action: "BLOCK_AND_REPORT", blockers: ["Duplicate Issue belongs to the wrong source repository."] };
  }
  if (duplicatePr && !exactRepositoryUrl(duplicatePr, packet.repository, "pull")) {
    return { status: "BLOCKED", next_action: "BLOCK_AND_REPORT", blockers: ["Duplicate PR belongs to the wrong source repository."] };
  }
  if (!duplicateIssue && !duplicatePr && source_issue.observed !== true) {
    return { status: "ACTIVE", next_action: "CREATE_SOURCE_ISSUE", blockers: [] };
  }
  const selectedIssue = duplicateIssue ?? source_issue.issue_url;
  if (selectedIssue && (!exactRepositoryUrl(selectedIssue, packet.repository, "issue")
    || (source_issue.fingerprint && source_issue.fingerprint !== packet.fingerprint))) {
    return { status: "BLOCKED", next_action: "BLOCK_AND_REPORT", blockers: ["Source Issue readback does not match the maintenance fingerprint/repository."] };
  }
  const selectedPr = duplicatePr ?? source_pr.pr_url;
  if (!selectedPr && !(source_worker.observed === true && source_worker.status === "LAUNCHED")) {
    return { status: "ACTIVE", next_action: "LAUNCH_SOURCE_WORKER", blockers: [] };
  }
  if (!selectedPr && !source_pr.pr_url) {
    return { status: "ACTIVE", next_action: "WAIT_SOURCE_PR", blockers: [] };
  }
  if (!exactRepositoryUrl(selectedPr, packet.repository, "pull")
    || source_pr.observed !== true
    || source_pr.admission !== "PASS") {
    return { status: "ACTIVE", next_action: "REVIEW_SOURCE_PR", blockers: [] };
  }
  const mergedSourceSha = source_pr.merged_source_sha;
  if (!/^[0-9a-f]{40}$/.test(mergedSourceSha ?? "")) {
    return { status: "ACTIVE", next_action: "MERGE_SOURCE_PR", blockers: [] };
  }
  if (target_installation.observed !== true || target_installation.source_commit !== mergedSourceSha) {
    return { status: "ACTIVE", next_action: "INSTALL_EXACT_SOURCE_SHA", blockers: [], merged_source_sha: mergedSourceSha };
  }
  if (target_regression.observed !== true
    || target_regression.source_commit !== mergedSourceSha
    || target_regression.status !== "PASS") {
    return { status: "ACTIVE", next_action: "RUN_TARGET_REGRESSION", blockers: [], merged_source_sha: mergedSourceSha };
  }
  if (wave_resume.observed !== true || wave_resume.source_commit !== mergedSourceSha) {
    return { status: "ACTIVE", next_action: "RESUME_TARGET_WAVE", blockers: [], merged_source_sha: mergedSourceSha };
  }
  return {
    status: "COMPLETE",
    next_action: "NONE",
    blockers: [],
    merged_source_sha: mergedSourceSha,
  };
}

export function automationProfile(profile = "team_safe") {
  const selected = AUTOMATION_PROFILES[profile];
  if (!selected) throw new Error(`Unknown automation profile: ${profile}`);
  return { ...selected };
}

export function reviewTopologyForRisk({ profile = "team_safe", risk } = {}) {
  automationProfile(profile);
  if (!new Set(["Low", "Medium", "High"]).has(risk)) throw new Error(`Unknown risk: ${risk}`);
  if (risk === "High") {
    return {
      reviewers: ["reviewer", "qa", "admission-reviewer", "security-reviewer", "domain-reviewer"],
      deterministic_admission: true,
      exact_merge_authorization: true,
      automatic_merge: false,
    };
  }
  if (risk === "Medium") {
    return {
      reviewers: ["reviewer", "qa", "admission-reviewer"],
      deterministic_admission: true,
      exact_merge_authorization: true,
      automatic_merge: false,
    };
  }
  return {
    reviewers: profile === "regulated" ? ["reviewer", "qa", "admission-reviewer"] : ["reviewer-qa"],
    deterministic_admission: true,
    exact_merge_authorization: profile !== "solo_fast",
    automatic_merge: profile === "solo_fast",
  };
}

export function evaluateAuthorityLease(lease = {}, context = {}, { now = new Date().toISOString() } = {}) {
  const blockers = [];
  try {
    automationProfile(lease.profile);
  } catch (error) {
    blockers.push(error.message);
  }
  if (!hasText(lease.authority_id)) blockers.push("Authority lease requires a stable authority_id.");
  if (!hasText(lease.approved_by)) blockers.push("Authority lease requires approved_by.");
  if (!hasText(lease.plan_revision) || lease.plan_revision !== context.plan_revision) blockers.push("Authority lease plan revision does not match.");
  if (!hasStringList(lease.repositories) || !lease.repositories.includes(context.repository)) blockers.push("Authority lease does not cover this repository.");
  if (!hasStringList(lease.plan_item_ids) && !Array.isArray(lease.issue_ids)) blockers.push("Authority lease requires plan or Issue scope.");
  if (hasText(context.plan_item_id) && !(lease.plan_item_ids ?? []).includes(context.plan_item_id)) blockers.push("Authority lease does not cover this plan item.");
  if (Number.isInteger(context.issue_id) && !(lease.issue_ids ?? []).includes(context.issue_id)) blockers.push("Authority lease does not cover this Issue.");
  if (!hasStringList(lease.allowed_actions) || !lease.allowed_actions.includes(context.action)) blockers.push("Authority lease does not allow this action.");
  if (!Number.isInteger(lease.max_worker_launches) || lease.max_worker_launches < 0
    || !Number.isInteger(context.worker_launches) || context.worker_launches > lease.max_worker_launches) {
    blockers.push("Authority lease Worker launch budget is invalid or exhausted.");
  }
  if (!Number.isInteger(lease.max_github_writes) || lease.max_github_writes < 0
    || !Number.isInteger(context.github_writes) || context.github_writes > lease.max_github_writes) {
    blockers.push("Authority lease GitHub write budget is invalid or exhausted.");
  }
  if (!hasText(lease.expires_at) || Number.isNaN(Date.parse(lease.expires_at))
    || Date.parse(lease.expires_at) <= Date.parse(now)) {
    blockers.push("Authority lease is invalid or expired.");
  }
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
}

function stableOperationId(repository, kind, key, target) {
  return createHash("sha256")
    .update(JSON.stringify({ repository, kind, key, target: canonicalPacketValue(target) }))
    .digest("hex");
}

function projectStatusSatisfies(current, target) {
  if (current === target) return true;
  if (new Set(["Done", "Canceled"]).has(current)) return true;
  if (current === "Blocked") {
    return new Set(["Backlog", "Ready", "In Progress", "Validation", "Blocked"]).has(target);
  }
  const currentRank = PROJECT_STATUS_ORDER.indexOf(current);
  const targetRank = PROJECT_STATUS_ORDER.indexOf(target);
  return currentRank >= 0 && targetRank >= 0 && currentRank >= targetRank;
}

export function buildMaterializationJournal({
  run_id,
  repository,
  desired_items = [],
  desired_relations = [],
  ledger = {},
} = {}) {
  if (!hasText(run_id)) throw new Error("Materialization journal requires run_id.");
  if (!REPOSITORY_PATTERN.test(repository ?? "")) throw new Error("Materialization journal requires repository.");
  const existingItems = ledger.items ?? {};
  const suppliedCompleted = new Set(ledger.completed_operation_ids ?? []);
  const existingRelations = new Set(ledger.relations ?? []);
  const partition = { existing: [], missing: [] };
  const operations = [];

  for (const desired of desired_items) {
    if (!hasText(desired?.plan_item_id)) throw new Error("Desired materialization item requires plan_item_id.");
    const key = desired.plan_item_id;
    const current = existingItems[key];
    const requestedTarget = desired.target ?? {};
    const target = { ...requestedTarget };
    let action = "KEEP";
    let reason = "ALREADY_DESIRED";
    if (!current) {
      partition.missing.push(key);
      action = "CREATE";
      reason = "MISSING";
    } else {
      partition.existing.push(key);
      const currentRank = PROJECT_STATUS_ORDER.indexOf(current.project_status);
      const targetRank = PROJECT_STATUS_ORDER.indexOf(requestedTarget.project_status);
      const preserveClosed = current.issue_state === "CLOSED" && requestedTarget.issue_state === "OPEN";
      const preserveBlocked = current.project_status === "Blocked";
      const preserveTerminal = new Set(["Done", "Canceled"]).has(current.project_status);
      const preserveAdvanced = currentRank > targetRank && targetRank >= 0;
      if (preserveClosed) target.issue_state = current.issue_state;
      if (preserveBlocked || preserveTerminal || preserveAdvanced) target.project_status = current.project_status;
      const metadataChanged = Object.entries(target).some(([field, value]) => {
        return !new Set(["issue_state", "project_status"]).has(field)
          && JSON.stringify(canonicalPacketValue(current[field])) !== JSON.stringify(canonicalPacketValue(value));
      });
      if (preserveClosed) {
        action = metadataChanged ? "ADVANCE" : "KEEP";
        reason = metadataChanged ? "ALIGN_METADATA_PRESERVE_CLOSED" : "PRESERVE_CLOSED";
      } else if (preserveBlocked) {
        action = metadataChanged ? "BLOCK" : "KEEP";
        reason = metadataChanged ? "BLOCKED_STATE_REQUIRES_RECONCILIATION" : "PRESERVE_BLOCKED";
      } else if (preserveTerminal) {
        action = metadataChanged ? "ADVANCE" : "KEEP";
        reason = metadataChanged ? "ALIGN_METADATA_PRESERVE_TERMINAL" : "PRESERVE_TERMINAL";
      } else if (preserveAdvanced) {
        action = metadataChanged ? "ADVANCE" : "KEEP";
        reason = metadataChanged ? "ALIGN_METADATA_PRESERVE_STATUS" : "PRESERVE_ADVANCED_STATUS";
      } else if (targetRank > currentRank && currentRank >= 0) {
        action = "ADVANCE";
        reason = "MONOTONIC_ADVANCE";
      } else if (current.project_status !== target.project_status || current.issue_state !== target.issue_state) {
        action = "BLOCK";
        reason = "UNKNOWN_LIFECYCLE_TRANSITION";
      } else if (metadataChanged) {
        action = "ADVANCE";
        reason = "ALIGN_APPROVED_METADATA";
      }
    }
    operations.push({
      operation_id: stableOperationId(repository, "item", key, target),
      kind: "item",
      key,
      before: current ?? null,
      target,
      action,
      reason,
    });
  }

  for (const relation of desired_relations) {
    const key = `${relation.kind}:${relation.from}>${relation.to}`;
    const target = { kind: relation.kind, from: relation.from, to: relation.to };
    const exists = existingRelations.has(key);
    operations.push({
      operation_id: stableOperationId(repository, "relation", key, target),
      kind: "relation",
      key,
      before: exists ? target : null,
      target,
      action: exists ? "KEEP" : "CREATE",
      reason: exists ? "ALREADY_DESIRED" : "MISSING",
    });
  }

  partition.existing.sort();
  partition.missing.sort();
  const operationIds = new Set(operations.map((operation) => operation.operation_id));
  const completed = new Set([...suppliedCompleted].filter((id) => operationIds.has(id)));
  const unknownCompleted = [...suppliedCompleted].filter((id) => !operationIds.has(id)).sort();
  const remainingOperations = operations.filter((operation) => {
    return new Set(["CREATE", "ADVANCE", "BLOCK"]).has(operation.action) && !completed.has(operation.operation_id);
  });
  const blocked = operations.some((operation) => operation.action === "BLOCK") || unknownCompleted.length > 0;
  return {
    run_id,
    repository,
    status: blocked ? "BLOCKED" : (remainingOperations.length === 0 ? "COMPLETE" : "RESUMABLE"),
    partition,
    operations,
    completed_operation_ids: [...completed],
    remaining_operations: remainingOperations.map((operation) => operation.operation_id),
    blockers: [
      ...(operations.some((operation) => operation.action === "BLOCK")
        ? ["Materialization contains a BLOCK operation that requires reconciliation."]
        : []),
      ...(unknownCompleted.length > 0
        ? [`Completed operation IDs are not part of this journal: ${unknownCompleted.join(", ")}.`]
        : []),
    ],
  };
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

function canonicalPacketValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalPacketValue(item));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "packet_digest" || key === "approval" || key === "human_approvals") continue;
    result[key] = canonicalPacketValue(value[key]);
  }
  return result;
}

export function packetDigest(packet) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalPacketValue(packet)))
    .digest("hex");
}

function roadmapItems(roadmap) {
  return (roadmap?.phases ?? []).flatMap((phase) => (phase.epics ?? []).map((epic) => ({
    ...epic,
    phase: phase.phase,
    parent_plan_item_id: null,
  })));
}

function allPlanDependencies(contracts) {
  const dependencies = [
    ...(contracts?.global_roadmap?.phases ?? []).flatMap((phase) => phase.dependencies ?? []),
    ...(contracts?.phase_plan?.dependencies ?? []),
  ];
  const unique = new Map();
  for (const dependency of dependencies) {
    unique.set(`${dependency?.blocking}>${dependency?.blocked}`, dependency);
  }
  return [...unique.values()];
}

function materializationItems(contracts) {
  const allItems = new Map();
  for (const item of [...roadmapItems(contracts?.global_roadmap), ...(contracts?.phase_plan?.hierarchy ?? [])]) {
    if (!hasText(item?.plan_item_id)) continue;
    allItems.set(item.plan_item_id, { ...(allItems.get(item.plan_item_id) ?? {}), ...item });
  }
  const items = new Map();
  for (const item of contracts?.phase_plan?.hierarchy ?? []) {
    if (hasText(item?.plan_item_id)) items.set(item.plan_item_id, allItems.get(item.plan_item_id) ?? item);
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const dependency of allPlanDependencies(contracts)) {
      if (!items.has(dependency?.blocked) || items.has(dependency?.blocking)) continue;
      const blocking = allItems.get(dependency.blocking);
      if (blocking) {
        items.set(dependency.blocking, blocking);
        expanded = true;
      }
    }
  }
  return [...items.values()];
}

function materializationDependencies(contracts) {
  const ids = new Set(materializationItems(contracts).map((item) => item.plan_item_id));
  return allPlanDependencies(contracts).filter((dependency) => {
    return ids.has(dependency?.blocking) && ids.has(dependency?.blocked);
  });
}

function itemMetadataMatches(left, right) {
  return left?.title === right?.title
    && PROJECT_FIELDS.every((field) => left?.[field] === right?.[field]);
}

export function validatePlanContracts(contracts, { require_approval = true } = {}) {
  const blockers = [];
  const roadmap = contracts?.global_roadmap;
  const phasePlan = contracts?.phase_plan;
  if (!roadmap || roadmap.packet_type !== "global_roadmap") blockers.push("Missing Global Roadmap Packet.");
  if (!phasePlan || phasePlan.packet_type !== "phase_plan") blockers.push("Missing Phase Plan Packet.");
  if (blockers.length > 0) return { valid: false, blockers };

  if (roadmap.schema_version !== 2 || phasePlan.schema_version !== 2) blockers.push("Plan contracts require schema_version 2.");
  if (!hasText(roadmap.revision)) blockers.push("Global Roadmap requires an exact revision.");
  if (!hasText(roadmap.canonical_brief_revision)) blockers.push("Global Roadmap requires the approved Canonical Brief revision.");
  if (!DIGEST_PATTERN.test(roadmap.packet_digest ?? "") || roadmap.packet_digest !== packetDigest(roadmap)) {
    blockers.push("Global Roadmap packet digest is missing or stale.");
  }
  if (roadmap.human_approvals?.roadmap?.revision !== roadmap.revision
    || roadmap.human_approvals.roadmap.packet_digest !== roadmap.packet_digest) {
    blockers.push("Global Roadmap approval must bind the exact revision and digest.");
  }
  if (require_approval && roadmap.human_approvals?.roadmap?.status !== "APPROVED") {
    blockers.push("Global Roadmap requires human approval before materialization.");
  }
  if (require_approval && !hasText(roadmap.human_approvals?.roadmap?.approved_by)) {
    blockers.push("Global Roadmap approval requires a named human identity.");
  }
  if (require_approval
    && (roadmap.human_approvals?.current_phase_entry?.status !== "APPROVED"
      || roadmap.human_approvals.current_phase_entry.phase !== roadmap.current_phase
      || !hasText(roadmap.human_approvals.current_phase_entry.approved_by))) {
    blockers.push("Current phase entry requires named human approval for the exact roadmap phase.");
  }
  const phaseNames = (roadmap.phases ?? []).map((phase) => phase.phase);
  if (!sameStringList(phaseNames, PHASES)) blockers.push("Global Roadmap must contain the eight lifecycle phases in canonical order.");
  for (const phase of roadmap.phases ?? []) {
    for (const field of ["outcomes", "epics", "risks", "entry_criteria", "exit_criteria"]) {
      if (!Array.isArray(phase[field]) || phase[field].length === 0) blockers.push(`Roadmap ${phase.phase ?? "<unknown>"} requires non-empty ${field}.`);
    }
    if (!Array.isArray(phase.dependencies)) blockers.push(`Roadmap ${phase.phase ?? "<unknown>"} requires typed dependencies.`);
  }

  if (!hasText(phasePlan.revision)) blockers.push("Phase Plan requires an exact revision.");
  if (phasePlan.phase !== roadmap.current_phase) blockers.push("Phase Plan phase must match the current roadmap phase.");
  if (!hasText(phasePlan.iteration)) blockers.push("Phase Plan requires an iteration.");
  for (const field of ["hierarchy", "dependencies", "ready_wave", "deferred", "phase_exit_evidence"]) {
    if (!Array.isArray(phasePlan[field])) blockers.push(`Phase Plan requires ${field}.`);
  }
  if ((phasePlan.ready_wave ?? []).length > 5) blockers.push("Phase Plan Ready wave cannot exceed five leaves.");
  if (!DIGEST_PATTERN.test(phasePlan.packet_digest ?? "") || phasePlan.packet_digest !== packetDigest(phasePlan)) {
    blockers.push("Phase Plan packet digest is missing or stale.");
  }
  if (phasePlan.approval?.revision !== phasePlan.revision
    || phasePlan.approval.packet_digest !== phasePlan.packet_digest) {
    blockers.push("Phase Plan approval must bind the exact revision and digest.");
  }
  if (require_approval && phasePlan.approval?.status !== "APPROVED") {
    blockers.push("Phase Plan requires human approval before materialization.");
  }
  if (require_approval && !hasText(phasePlan.approval?.approved_by)) {
    blockers.push("Phase Plan approval requires a named human identity.");
  }

  const allItems = [...roadmapItems(roadmap), ...(phasePlan.hierarchy ?? [])];
  const byId = new Map();
  for (const item of allItems) {
    if (!PLAN_ITEM_PATTERN.test(item?.plan_item_id ?? "")) {
      blockers.push(`Invalid or missing plan_item_id: ${item?.plan_item_id ?? "<unknown>"}.`);
      continue;
    }
    if (!hasText(item.title)) blockers.push(`Missing exact title for ${item.plan_item_id}.`);
    for (const field of PROJECT_FIELDS) {
      if (!hasText(item[field])) blockers.push(`Missing ${field} for ${item.plan_item_id}.`);
      else if (!PROJECT_FIELD_VALUES[field].has(item[field])) blockers.push(`Invalid ${field} for ${item.plan_item_id}.`);
    }
    if (!PHASES.includes(item.phase)) blockers.push(`Invalid phase for ${item.plan_item_id}.`);
    if (!MATERIALIZATION_STATUSES.has(item.status)) blockers.push(`Invalid materialization status for ${item.plan_item_id}.`);
    const existing = byId.get(item.plan_item_id);
    if (existing && !itemMetadataMatches(existing, item)) {
      blockers.push(`Conflicting title or Project metadata for ${item.plan_item_id}.`);
    } else if (!existing) {
      byId.set(item.plan_item_id, item);
    }
  }

  const hierarchyIds = new Set((phasePlan.hierarchy ?? []).map((item) => item.plan_item_id));
  if (hierarchyIds.size !== (phasePlan.hierarchy ?? []).length) {
    blockers.push("Duplicate Phase Plan hierarchy plan_item_id values are not allowed.");
  }
  if (!hierarchyIds.has(phasePlan.materialization_report_parent_plan_item_id)) {
    blockers.push("Materialization report parent must identify an exact Phase Plan hierarchy item.");
  }
  for (const item of phasePlan.hierarchy ?? []) {
    if (item.parent_plan_item_id && !byId.has(item.parent_plan_item_id)) {
      blockers.push(`Unknown parent plan item: ${item.parent_plan_item_id}.`);
    }
  }

  const dependencies = allPlanDependencies(contracts);
  for (const dependency of dependencies) {
    if (!PLAN_ITEM_PATTERN.test(dependency?.blocking ?? "") || !byId.has(dependency.blocking)) {
      blockers.push(`Unknown dependency blocking plan_item_id: ${dependency?.blocking ?? "<unknown>"}.`);
    }
    if (!PLAN_ITEM_PATTERN.test(dependency?.blocked ?? "") || !byId.has(dependency.blocked)) {
      blockers.push(`Unknown dependency blocked plan_item_id: ${dependency?.blocked ?? "<unknown>"}.`);
    }
    if (dependency?.blocking === dependency?.blocked) blockers.push(`Self dependency is not allowed: ${dependency.blocking}.`);
  }

  const readyIds = new Set((phasePlan.ready_wave ?? []).map((item) => item.plan_item_id));
  if (readyIds.size !== (phasePlan.ready_wave ?? []).length) blockers.push("Duplicate Ready wave plan_item_id values are not allowed.");
  for (const ready of phasePlan.ready_wave ?? []) {
    blockers.push(...mergeUnitReasons(ready).map((reason) => `${ready.plan_item_id ?? "<unknown>"}: ${reason}`));
    const hierarchyItem = (phasePlan.hierarchy ?? []).find((item) => item.plan_item_id === ready.plan_item_id);
    if (!hierarchyItem || !hasText(hierarchyItem.parent_plan_item_id)) {
      blockers.push(`Ready leaf ${ready.plan_item_id} must appear in hierarchy with a real parent.`);
      continue;
    }
    if (ready.parent_plan_item_id !== hierarchyItem.parent_plan_item_id) {
      blockers.push(`Ready leaf ${ready.plan_item_id} parent does not match hierarchy.`);
    }
    if (ready.title !== hierarchyItem.title
      || ["work_type", "priority", "size", "risk", "qa_required"].some((field) => ready[field] !== hierarchyItem[field])) {
      blockers.push(`Ready leaf ${ready.plan_item_id} metadata does not match its hierarchy item.`);
    }
    if (hierarchyItem.status !== "Ready") blockers.push(`Ready leaf ${ready.plan_item_id} must target Project status Ready.`);
    if (new Set(["L", "XL"]).has(ready.size)) blockers.push(`Ready leaf ${ready.plan_item_id} must be decomposed to XS-M.`);
    for (const id of ready.dependencies ?? []) {
      if (!dependencies.some((dependency) => dependency.blocked === ready.plan_item_id && dependency.blocking === id)) {
        blockers.push(`Ready leaf ${ready.plan_item_id} dependency ${id} is missing from typed dependencies.`);
      }
    }
  }
  for (const item of phasePlan.hierarchy ?? []) {
    if (item.status === "Ready" && !readyIds.has(item.plan_item_id)) {
      blockers.push(`Hierarchy item ${item.plan_item_id} targets Ready but is absent from ready_wave.`);
    }
  }

  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export function evaluateOrchestratorStart(contracts, startPacket, { now = new Date().toISOString() } = {}) {
  const blockers = [];
  const validation = validatePlanContracts(contracts);
  if (!validation.valid) blockers.push(...validation.blockers);
  const roadmap = contracts?.global_roadmap ?? {};
  const phasePlan = contracts?.phase_plan ?? {};
  const expectedMaterializationIds = materializationItems(contracts).map((item) => item.plan_item_id).sort();
  const expectedReadyIds = (phasePlan.ready_wave ?? []).map((item) => item.plan_item_id).sort();
  const approvedItems = startPacket?.approved_plan_items ?? [];
  const approvedIds = approvedItems.map((item) => item.plan_item_id).sort();
  const authorization = startPacket?.authorization ?? {};
  const lease = startPacket?.authority_lease ?? {};

  if (startPacket?.schema_version !== 2 || startPacket?.packet_type !== "orchestrator_start") blockers.push("Missing schema_version 2 Orchestrator Start Packet.");
  if (!REPOSITORY_PATTERN.test(startPacket?.repository ?? "")) blockers.push("Orchestrator Start requires an exact repository.");
  if (!hasText(startPacket?.wave_id)) blockers.push("Orchestrator Start requires a stable wave_id.");
  if (startPacket?.global_roadmap_revision !== roadmap.revision
    || startPacket?.global_roadmap_digest !== roadmap.packet_digest) {
    blockers.push("Orchestrator Start does not bind the exact approved Global Roadmap.");
  }
  if (startPacket?.phase_plan_revision !== phasePlan.revision
    || startPacket?.phase_plan_digest !== phasePlan.packet_digest) {
    blockers.push("Orchestrator Start does not bind the exact approved Phase Plan.");
  }
  if (!/^[0-9a-f]{40}$/.test(startPacket?.base_sha ?? "")) blockers.push("Orchestrator Start requires an exact base SHA.");
  if (!hasText(startPacket?.valid_until) || Number.isNaN(Date.parse(startPacket.valid_until))
    || Date.parse(startPacket.valid_until) <= Date.parse(now)) {
    blockers.push("Orchestrator Start authorization is missing, invalid, or expired.");
  }
  if (authorization.status !== "APPROVED" || !hasText(authorization.approved_by)) {
    blockers.push("Orchestrator Start requires a named human approval.");
  }
  if (authorization.approved_by !== lease.approved_by) {
    blockers.push("Capability authorization and Wave Authority Lease must use the same human approval.");
  }
  if (!sameStringList([...(lease.plan_item_ids ?? [])].sort(), approvedIds)) {
    blockers.push("Wave Authority Lease plan items do not match the approved Start scope.");
  }
  const leaseActions = startPacket?.mode === "wave_execution"
    ? ["materialize", "create_worker"]
    : ["materialize"];
  for (const action of leaseActions) {
    const leaseResult = evaluateAuthorityLease(lease, {
      repository: startPacket?.repository,
      plan_revision: phasePlan.revision,
      action,
      worker_launches: 0,
      github_writes: 0,
    }, { now });
    blockers.push(...leaseResult.blockers);
  }
  const readyRisks = approvedItems.map((approved) => {
    return (phasePlan.ready_wave ?? []).find((item) => item.plan_item_id === approved.plan_item_id)?.risk;
  });
  const exactMergeRequired = lease.profile !== "solo_fast"
    || readyRisks.some((risk) => new Set(["Medium", "High"]).has(risk));
  if (exactMergeRequired && authorization.merge_requires_exact_sha_authorization !== true) {
    blockers.push("Medium/High or non-solo merge requires exact PR and head SHA authorization.");
  }

  if (startPacket?.mode === "materialization_only") {
    if (approvedItems.length < 1 || approvedItems.length > 100) blockers.push("Materialization-only Start must approve one to 100 items.");
    if (expectedReadyIds.length > 0) blockers.push("A materialization-only start requires an empty approved Ready wave.");
    if (!sameStringList(approvedIds, expectedMaterializationIds)) {
      blockers.push("Materialization-only approved plan items must exactly match every approved materialization item.");
    }
    const noWorkerAuthority = authorization.create_top_level_worker_tasks === false
      && authorization.managed_worktrees === false
      && authorization.max_worker_launches === 0
      && authorization.max_concurrent_write_workers === 0
      && authorization.monitor_and_steer === false
      && authorization.archive_after_done === false
      && authorization.create_high_risk_review_tasks === false;
    if (!noWorkerAuthority) blockers.push("Worker authority must be disabled in materialization-only mode.");
  } else if (startPacket?.mode === "wave_execution") {
    if (approvedItems.length < 1 || approvedItems.length > 5) blockers.push("Wave execution Start must approve one to five leaves.");
    if (expectedReadyIds.length === 0) blockers.push("Wave execution requires at least one approved Ready leaf.");
    if (!sameStringList(approvedIds, expectedReadyIds)) {
      blockers.push("Wave execution approved plan items must exactly match the approved Ready wave.");
    }
    for (const approved of approvedItems) {
      const ready = (phasePlan.ready_wave ?? []).find((item) => item.plan_item_id === approved.plan_item_id);
      if (!ready || !sameStringList(approved.conflict_keys, ready.conflict_keys)) {
        blockers.push(`Orchestrator Start conflict keys do not match ${approved.plan_item_id ?? "<unknown>"}.`);
      }
    }
    const workerAuthority = authorization.create_top_level_worker_tasks === true
      && authorization.managed_worktrees === true
      && Number.isInteger(authorization.max_worker_launches)
      && authorization.max_worker_launches >= 1
      && authorization.max_worker_launches <= 5
      && Number.isInteger(authorization.max_concurrent_write_workers)
      && authorization.max_concurrent_write_workers >= 1
      && authorization.max_concurrent_write_workers <= 2
      && authorization.monitor_and_steer === true
      && authorization.archive_after_done === true
      && authorization.create_high_risk_review_tasks === readyRisks.includes("High");
    if (!workerAuthority) blockers.push("Wave execution Worker authority is incomplete or exceeds configured limits.");
  } else {
    blockers.push("Orchestrator Start mode must be materialization_only or wave_execution.");
  }

  if (new Set(approvedIds).size !== approvedIds.length) blockers.push("Orchestrator Start contains duplicate approved plan items.");
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
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

function sameStringSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && sameStringList([...left].sort(), [...right].sort());
}

function sameHashMap(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return sameStringList(leftKeys, rightKeys)
    && leftKeys.every((key) => /^[0-9a-f]{64}$/.test(left[key]) && left[key] === right[key]);
}

function validRawEvidenceKeys(value) {
  return Array.isArray(value)
    && value.length > 0
    && new Set(value).size === value.length
    && value.every((key) => RAW_ADMISSION_FIELDS.has(key));
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

export function materializeApprovedPlan(contracts, ledger = {}) {
  const validation = validatePlanContracts(contracts);
  if (!validation.valid) throw new Error(`Plan materialization contract is invalid: ${validation.blockers.join(" ")}`);
  const packet = contracts.phase_plan;
  const itemMap = new Map();
  for (const item of [...materializationItems(contracts), ...(packet.ready_wave ?? [])]) {
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
  const dependencies = materializationDependencies(contracts);
  for (const dependency of dependencies) {
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
  const desiredRelations = [];
  for (const item of items) {
    if (!item.parent_plan_item_id) continue;
    const key = `parent:${item.parent_plan_item_id}>${item.plan_item_id}`;
    desiredRelations.push({
      kind: "parent",
      key,
      from: item.parent_plan_item_id,
      to: item.plan_item_id,
      parent: item.parent_plan_item_id,
      child: item.plan_item_id,
    });
  }
  for (const dependency of dependencies) {
    const key = `dependency:${dependency.blocking}>${dependency.blocked}`;
    desiredRelations.push({
      kind: "dependency",
      key,
      from: dependency.blocking,
      to: dependency.blocked,
      ...dependency,
    });
  }
  const liveItems = { ...(ledger.items ?? {}) };
  for (const item of items) {
    if (!mapping[item.plan_item_id] || liveItems[item.plan_item_id]) continue;
    liveItems[item.plan_item_id] = {
      issue_url: mapping[item.plan_item_id],
      issue_state: "OPEN",
      project_status: item.status,
    };
  }
  const journal = buildMaterializationJournal({
    run_id: ledger.run_id ?? `materialization-${packet.revision}`,
    repository: ledger.repository ?? "local/materialization",
    desired_items: items.map((item) => ({
      plan_item_id: item.plan_item_id,
      target: {
        issue_state: "OPEN",
        project_status: item.status,
        title: item.title,
        phase: item.phase,
        work_type: item.work_type,
        priority: item.priority,
        size: item.size,
        risk: item.risk,
        qa_required: item.qa_required,
      },
    })),
    desired_relations: desiredRelations,
    ledger: {
      items: liveItems,
      relations: [...relationships],
      completed_operation_ids: ledger.completed_operation_ids ?? [],
    },
  });
  const createItemIds = new Set(journal.operations
    .filter((operation) => operation.kind === "item" && operation.action === "CREATE")
    .map((operation) => operation.key));
  const issueCreates = items
    .filter((item) => createItemIds.has(item.plan_item_id))
    .sort((left, right) => depth(left) - depth(right));
  const createRelationKeys = new Set(journal.operations
    .filter((operation) => operation.kind === "relation" && operation.action === "CREATE")
    .map((operation) => operation.key));
  const relationshipCreates = desiredRelations.filter((relation) => createRelationKeys.has(relation.key));
  return {
    run_id: journal.run_id,
    repository: journal.repository,
    approval_revision: packet.approval.revision,
    global_roadmap_revision: contracts.global_roadmap.revision,
    global_roadmap_digest: contracts.global_roadmap.packet_digest,
    phase_plan_digest: packet.packet_digest,
    issue_creates: issueCreates,
    relationship_creates: relationshipCreates,
    operation_journal: journal.operations,
    completed_operation_ids: journal.completed_operation_ids,
    remaining_operations: journal.remaining_operations,
    resume_state: journal.status,
    blockers: journal.blockers,
    partition: journal.partition,
    requires_read_after_write: true,
    agent_ready_candidates: (packet.ready_wave ?? []).map((item) => item.plan_item_id),
    materialization_mode: (packet.ready_wave ?? []).length === 0 ? "materialization_only" : "wave_execution",
    report_parent_plan_item_id: packet.materialization_report_parent_plan_item_id,
  };
}

export function evaluateMaterializationReport(contracts, report) {
  const blockers = [];
  const validation = validatePlanContracts(contracts);
  if (!validation.valid) blockers.push(...validation.blockers);
  const packet = contracts?.phase_plan ?? {};
  const roadmap = contracts?.global_roadmap ?? {};
  const observed = (records, key) => new Set((records ?? []).filter((item) => item.observed === true).map(key));
  const validIssueUrl = (value) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(value ?? "");
  const validReportUrl = (value) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+#issuecomment-\d+$/.test(value ?? "");
  const mappingRecords = (report.mapping ?? []).filter((item) => Number.isInteger(item.issue_number)
    && item.issue_number > 0
    && validIssueUrl(item.issue_url)
    && item.issue_url.endsWith(`/issues/${item.issue_number}`));
  const mapping = new Set(mappingRecords.map((item) => item.plan_item_id));
  const items = materializationItems(contracts);
  const itemById = new Map(items.map((item) => [item.plan_item_id, item]));
  const expectedItems = new Set(itemById.keys());
  for (const id of expectedItems) if (!mapping.has(id)) blockers.push(`Missing Issue mapping for ${id}.`);
  for (const id of mapping) if (!expectedItems.has(id)) blockers.push(`Unexpected Issue mapping for ${id}.`);
  if (mappingRecords.length !== (report.mapping ?? []).length || mapping.size !== mappingRecords.length) blockers.push("Issue mapping contains invalid or duplicate evidence.");

  const expectedHierarchy = new Set((packet.hierarchy ?? [])
    .filter((item) => item.parent_plan_item_id)
    .map((item) => `${item.parent_plan_item_id}>${item.plan_item_id}`));
  const actualHierarchy = observed(report.hierarchy_readback, (item) => `${item.parent_plan_item_id}>${item.child_plan_item_id}`);
  for (const edge of expectedHierarchy) if (!actualHierarchy.has(edge)) blockers.push(`Missing hierarchy readback for ${edge}.`);
  for (const edge of actualHierarchy) if (!expectedHierarchy.has(edge)) blockers.push(`Unexpected hierarchy readback for ${edge}.`);

  const expectedDependencies = new Set(materializationDependencies(contracts).map((item) => `${item.blocking}>${item.blocked}`));
  const actualDependencies = observed(report.dependency_readback, (item) => `${item.blocking}>${item.blocked}`);
  for (const edge of expectedDependencies) if (!actualDependencies.has(edge)) blockers.push(`Missing dependency readback for ${edge}.`);
  for (const edge of actualDependencies) if (!expectedDependencies.has(edge)) blockers.push(`Unexpected dependency readback for ${edge}.`);

  const validProjectRecords = (report.project_readback ?? []).filter((item) => {
    const expected = itemById.get(item.plan_item_id);
    return expected
      && item.observed === true
      && hasText(item.project_item_id)
      && PROJECT_FIELDS.filter((field) => field !== "status").every((field) => item[field] === expected[field])
      && projectStatusSatisfies(item.status, expected.status);
  });
  const projectItems = observed(validProjectRecords, (item) => item.plan_item_id);
  for (const id of expectedItems) if (!projectItems.has(id)) blockers.push(`Missing Project readback for ${id}.`);
  for (const id of projectItems) if (!expectedItems.has(id)) blockers.push(`Unexpected Project readback for ${id}.`);
  if (validProjectRecords.length !== (report.project_readback ?? []).length || projectItems.size !== validProjectRecords.length) {
    blockers.push("Project readback contains invalid, stale, or duplicate field evidence.");
  }
  const readyItems = new Set((report.agent_ready_readback ?? [])
    .filter((item) => item.label_present === true && item.status === "Ready" && validIssueUrl(item.issue_url))
    .map((item) => item.plan_item_id));
  const expectedReady = new Set((packet.ready_wave ?? []).map((item) => item.plan_item_id));
  for (const id of expectedReady) if (!readyItems.has(id)) blockers.push(`Missing agent-ready readback for ${id}.`);
  for (const id of readyItems) if (!expectedReady.has(id)) blockers.push(`Unexpected agent-ready readback for ${id}.`);
  const expectedMode = (packet.ready_wave ?? []).length === 0 ? "materialization_only" : "wave_execution";
  if (report.materialization_mode !== expectedMode) blockers.push("Materialization report mode does not match the approved Ready wave.");
  if (report.global_roadmap_revision !== roadmap.revision) blockers.push("Materialization report revision does not match the approved Global Roadmap.");
  if (report.global_roadmap_digest !== roadmap.packet_digest) blockers.push("Materialization report digest does not match the approved Global Roadmap.");
  if (report.phase_plan_revision !== packet.revision) blockers.push("Materialization report revision does not match the approved Phase Plan.");
  if (report.phase_plan_digest !== packet.packet_digest) blockers.push("Materialization report digest does not match the approved Phase Plan.");
  if (report.report_parent_plan_item_id !== packet.materialization_report_parent_plan_item_id) blockers.push("Materialization report parent does not match the approved Phase Plan.");
  const parentMapping = mappingRecords.find((item) => item.plan_item_id === packet.materialization_report_parent_plan_item_id);
  if (!parentMapping || report.report_parent_issue_url !== parentMapping.issue_url) blockers.push("Materialization report parent Issue URL is not the mapped approved parent.");
  if (!validReportUrl(report.report_url) || !report.report_url.startsWith(`${report.report_parent_issue_url}#issuecomment-`)) {
    blockers.push("Materialization report URL is not a durable comment on the approved parent Issue.");
  }
  if (!hasText(report.run_id)) blockers.push("Materialization report requires a durable run_id.");
  if (!REPOSITORY_PATTERN.test(report.repository ?? "")) blockers.push("Materialization report requires an exact repository.");
  const journal = report.operation_journal ?? [];
  const operationIds = journal.map((operation) => operation?.operation_id);
  if (journal.length === 0
    || operationIds.some((id) => !DIGEST_PATTERN.test(id ?? ""))
    || new Set(operationIds).size !== operationIds.length) {
    blockers.push("Materialization operation journal is missing or contains invalid or duplicate operation IDs.");
  }
  const expectedOperationKeys = new Set([
    ...items.map((item) => `item:${item.plan_item_id}`),
    ...(packet.hierarchy ?? [])
      .filter((item) => item.parent_plan_item_id && itemById.has(item.parent_plan_item_id))
      .map((item) => `relation:parent:${item.parent_plan_item_id}>${item.plan_item_id}`),
    ...materializationDependencies(contracts)
      .map((item) => `relation:dependency:${item.blocking}>${item.blocked}`),
  ]);
  const actualOperationKeys = new Set(journal.map((operation) => `${operation.kind}:${operation.key}`));
  for (const key of expectedOperationKeys) if (!actualOperationKeys.has(key)) blockers.push(`Missing materialization operation ${key}.`);
  for (const operation of journal) {
    const expectedOperationId = stableOperationId(report.repository, operation?.kind, operation?.key, operation?.target);
    if (!new Set(["CREATE", "KEEP", "ADVANCE", "BLOCK"]).has(operation?.action)
      || !hasText(operation?.key)
      || !operation?.target
      || (report.status === "PASS" && !operation?.after)) {
      blockers.push(`Materialization operation ${operation?.key ?? "<unknown>"} lacks full lifecycle evidence.`);
    }
    if (operation?.operation_id !== expectedOperationId) {
      blockers.push(`Materialization operation ${operation?.key ?? "<unknown>"} has a non-stable operation ID.`);
    }
  }
  const completedIds = new Set(report.completed_operation_ids ?? []);
  const remainingIds = new Set(report.remaining_operations ?? []);
  if ([...completedIds, ...remainingIds].some((id) => !DIGEST_PATTERN.test(id ?? ""))) {
    blockers.push("Materialization resume sets contain invalid operation IDs.");
  }
  const operationIdSet = new Set(operationIds);
  if ([...completedIds, ...remainingIds].some((id) => !operationIdSet.has(id))) {
    blockers.push("Materialization resume sets reference operation IDs outside the journal.");
  }
  const mutatingIds = new Set(journal
    .filter((operation) => new Set(["CREATE", "ADVANCE", "BLOCK"]).has(operation.action))
    .map((operation) => operation.operation_id));
  const expectedRemainingIds = new Set([...mutatingIds].filter((id) => !completedIds.has(id)));
  if (!sameStringList([...remainingIds].sort(), [...expectedRemainingIds].sort())) {
    blockers.push("Materialization remaining operations do not match the uncompleted journal.");
  }
  if (report.status === "PASS"
    && (report.resume_state !== "COMPLETE" || remainingIds.size > 0
      || journal.some((operation) => operation.action === "BLOCK")
      || journal.some((operation) => new Set(["CREATE", "ADVANCE"]).has(operation.action)
        && !completedIds.has(operation.operation_id)))) {
    blockers.push("PASS materialization must have a complete journal with no remaining writes.");
  }
  if (report.status !== "PASS") blockers.push("Materialization did not PASS.", ...(report.blockers ?? []));
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
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

export function evaluateReviewTopology({ worker_id, agents = [], profile = "team_safe", risk = "Medium" }) {
  const reasons = [];
  const active = agents.filter((agent) => agent.active === true);
  if (active.length > 2) reasons.push("A Worker may keep at most two active direct subagents.");
  if (agents.some((agent) => agent.depth !== 1)) reasons.push("Subagent depth must be exactly one.");
  if (agents.some((agent) => agent.tracked_writes === true)) reasons.push("Review and QA agents must not create tracked changes.");
  const identities = [worker_id, ...agents.map((agent) => agent.id)].filter(hasText);
  if (new Set(identities).size !== identities.length) reasons.push("Worker, reviewer, QA, and admission identities must be distinct.");
  let requiredRoles = [];
  try {
    requiredRoles = reviewTopologyForRisk({ profile, risk }).reviewers;
  } catch (error) {
    reasons.push(error.message);
  }
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
    "automation_profile",
    "qa_tracked_worktree", "gate_tracked_worktree", "acceptance", "tdd",
    "local_validation", "reviews", "branch_ci", "baseline", "documentation", "rollout", "human_gates",
  ];
  const hasWorker = Object.hasOwn(evidence, "worker");
  const hasIssue = Object.hasOwn(evidence, "issue");
  const hasExecutor = Object.hasOwn(evidence, "executor");
  const hasBootstrap = Object.hasOwn(evidence, "bootstrap");
  const hasPublisher = Object.hasOwn(evidence, "publisher");
  const hasCanonicalPublication = Object.hasOwn(evidence, "canonical_publication");
  const issueAdmission = hasWorker && hasIssue
    && !hasExecutor && !hasBootstrap && !hasPublisher && !hasCanonicalPublication;
  const bootstrapAdmission = hasExecutor && hasBootstrap
    && !hasWorker && !hasIssue && !hasPublisher && !hasCanonicalPublication;
  const canonicalPublicationAdmission = hasPublisher && hasCanonicalPublication
    && !hasWorker && !hasIssue && !hasExecutor && !hasBootstrap;
  requirePass(
    evidence.schema_version === 2
      && evidence.packet_type === "pre_pr_admission"
      && requiredEvidenceFields.every((field) => Object.hasOwn(evidence, field))
      && Number(issueAdmission) + Number(bootstrapAdmission) + Number(canonicalPublicationAdmission) === 1
      && validRawEvidenceKeys(evidence.raw_evidence_keys),
    "Admission evidence does not satisfy the required packet shape for schema v2.",
  );
  requirePass(/^[0-9a-f]{40}$/.test(evidence.commit_sha ?? "") && evidence.commit_sha === evidence.current_sha, "Admission report is not bound to the full current commit SHA.");
  requirePass(Boolean(AUTOMATION_PROFILES[evidence.automation_profile]), "Admission evidence has an unknown automation profile.");
  requirePass(
    !evidence.configured_automation_profile || evidence.automation_profile === evidence.configured_automation_profile,
    "Admission automation profile does not match authoritative configuration.",
  );
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
  const subject = bootstrapAdmission
    ? evidence.bootstrap
    : canonicalPublicationAdmission
      ? evidence.canonical_publication
      : evidence.issue;
  const executionSource = bootstrapAdmission
    ? evidence.executor?.source
    : canonicalPublicationAdmission
      ? evidence.publisher?.source
      : evidence.worker?.source;
  if (bootstrapAdmission) {
    const configuredBootstrap = evidence.configured_bootstrap;
    requirePass(
      configuredBootstrap?.authority === "one-time-automated-control-plane-bootstrap"
        && /^[0-9a-f]{40}$/.test(configuredBootstrap?.base_sha ?? "")
        && evidence.bootstrap?.authority === configuredBootstrap.authority
        && evidence.bootstrap?.repository === configuredBootstrap.repository
        && evidence.bootstrap?.branch === configuredBootstrap.branch
        && evidence.bootstrap?.canonical_revision === configuredBootstrap.canonical_revision
        && /^agent\/bootstrap-[a-z0-9][a-z0-9-]*$/.test(evidence.bootstrap?.branch ?? "")
        && evidence.current_branch === configuredBootstrap.branch
        && evidence.current_base_sha === configuredBootstrap.base_sha
        && evidence.validated_base_sha === configuredBootstrap.base_sha,
      "Bootstrap admission is not bound to the exact configured repository, branch, base SHA, authority, and Canonical Brief revision.",
    );
  } else if (canonicalPublicationAdmission) {
    const configuredPublication = evidence.configured_canonical_publication;
    requirePass(
      configuredPublication?.authority === "human-approved-canonical-publication"
        && configuredPublication?.base_binding === "authoritative-origin-default-branch-at-launch"
        && evidence.canonical_tree_state?.config_unchanged === true
        && sameStringSet(
          evidence.canonical_tree_state?.changed_paths,
          configuredPublication?.allowed_paths,
        )
        && sameStringSet(
          configuredPublication?.allowed_paths,
          Object.keys(configuredPublication?.content_hashes ?? {}),
        )
        && sameHashMap(
          evidence.canonical_tree_state?.content_hashes,
          configuredPublication?.content_hashes,
        )
        && evidence.canonical_publication?.authority === configuredPublication.authority
        && evidence.canonical_publication?.repository === configuredPublication.repository
        && evidence.canonical_publication?.branch === configuredPublication.branch
        && evidence.canonical_publication?.canonical_revision === configuredPublication.canonical_revision
        && evidence.canonical_publication?.approved_by === configuredPublication.approved_by
        && evidence.canonical_publication?.approval_source?.kind === configuredPublication.approval_source?.kind
        && evidence.canonical_publication?.approval_source?.id === configuredPublication.approval_source?.id
        && /^agent\/canonical-brief-[a-z0-9][a-z0-9-]*$/.test(evidence.canonical_publication?.branch ?? "")
        && evidence.current_branch === configuredPublication.branch
        && evidence.base_sha_at_launch === evidence.current_base_sha
        && evidence.validated_base_sha === evidence.current_base_sha
        && evidence.canonical_tree_state?.base_revision === configuredPublication.superseded_revision
        && evidence.canonical_tree_state?.current_revision === configuredPublication.canonical_revision
        && evidence.canonical_tree_state?.current_approved_by === configuredPublication.approved_by
        && hasText(configuredPublication?.supersession_text)
        && evidence.canonical_tree_state?.current_text?.includes(configuredPublication.supersession_text),
      "Canonical publication admission is not bound to immutable base configuration, the exact repository, branch, launch base SHA, revisions, approval, approved content hashes, supersession text, and allowed diff scope.",
    );
  } else {
    requirePass(Number.isInteger(evidence.issue?.number) && evidence.issue.number > 0, "Admission evidence lacks a valid Issue number.");
    const branchPattern = Number.isInteger(evidence.issue?.number)
      ? new RegExp(`^agent/${evidence.issue.number}-[a-z0-9][a-z0-9-]*$`)
      : /^$/;
    requirePass(branchPattern.test(evidence.current_branch ?? ""), "Current branch does not match agent/<issue>-<slug>.");
    requirePass(evidence.issue?.is_leaf === true, "Only a leaf issue can enter admission.");
  }
  requirePass(Array.isArray(subject?.unresolved_dependencies) && subject.unresolved_dependencies.length === 0, "Blocking dependencies remain unresolved or dependency evidence is missing.");
  const riskMetadataValid = new Set(["Low", "Medium", "High"]).has(subject?.risk)
    && Array.isArray(subject?.high_risk_flags)
    && new Set(subject.high_risk_flags).size === subject.high_risk_flags.length
    && subject.high_risk_flags.every((flag) => new Set(["security", "auth", "data", "migration"]).has(flag));
  requirePass(riskMetadataValid, "Admission subject risk and high-risk flags are missing or invalid.");
  requirePass(new Set(["agent_task", "human"]).has(executionSource?.kind) && hasText(executionSource?.id), "Execution identity is missing.");
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

  const combinedLowRisk = issueAdmission
    && evidence.automation_profile !== "regulated"
    && subject?.risk === "Low"
    && (subject?.high_risk_flags ?? []).length === 0;
  const reviewerQaPass = reviewPassed(evidence.reviews?.reviewer_qa, evidence.current_sha, executionSource);
  const reviewerPass = reviewPassed(evidence.reviews?.reviewer, evidence.current_sha, executionSource);
  const qaPass = reviewPassed(evidence.reviews?.qa, evidence.current_sha, executionSource);
  const admissionPass = reviewPassed(evidence.reviews?.admission, evidence.current_sha, executionSource);
  if (combinedLowRisk) {
    requirePass(reviewerQaPass, "Low-risk admission requires one independent combined reviewer/QA evidence source.");
  } else {
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
  }
  requirePass(conditionalReviewPassed(evidence.reviews?.design, evidence.current_sha, executionSource), "Design review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  requirePass(conditionalReviewPassed(evidence.reviews?.security, evidence.current_sha, executionSource), "Security review is required and lacks independent evidence, or NOT_REQUIRED lacks a reason.");
  const highRisk = !riskMetadataValid || subject?.risk === "High"
    || (subject?.high_risk_flags ?? []).some((flag) => new Set(["security", "auth", "data", "migration"]).has(flag));
  if (highRisk) {
    requirePass(
      reviewPassed(evidence.reviews?.security, evidence.current_sha, executionSource)
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

export function orchestratorControl({
  queue_length,
  awaiting_human,
  launches,
  materialization_status = "COMPLETE",
  lease_valid = true,
}) {
  let nextAction = "DRAIN_WAVE";
  if (launches >= 5) nextAction = "HANDOFF";
  else if (awaiting_human) nextAction = "WAIT_HUMAN";
  else if (lease_valid !== true) nextAction = "BLOCK_AUTHORITY";
  else if (materialization_status === "BLOCKED") nextAction = "RECONCILE_MATERIALIZATION";
  else if (materialization_status === "RESUMABLE") nextAction = "RESUME_MATERIALIZATION";
  else if (materialization_status !== "COMPLETE") nextAction = "BLOCK_MATERIALIZATION_STATE";
  else if (queue_length > 0) nextAction = launches === 0 ? "LAUNCH_FIRST_WORKER" : "LAUNCH_NEXT_WORKER";
  return {
    heartbeat: queue_length > 0 && !awaiting_human ? "ACTIVE" : "PAUSE",
    handoff: launches >= 5 ? "REQUIRED" : "NOT_REQUIRED",
    next_action: nextAction,
  };
}

export function evaluateMerge({
  now,
  profile = "team_safe",
  risk = "Medium",
  repository_allows_auto_merge = false,
  high_risk_flags = null,
  authorization = {},
  pr = {},
  admission = {},
  current_base_sha,
  unresolved_dependencies = [],
}) {
  const blockers = [];
  const requirePass = (condition, message) => {
    if (!condition) blockers.push(message);
  };
  const automaticLowRisk = profile === "solo_fast"
    && risk === "Low"
    && repository_allows_auto_merge === true
    && Array.isArray(high_risk_flags)
    && high_risk_flags.length === 0;
  const mergeMode = automaticLowRisk ? "AUTOMATIC_LOW_RISK" : "HUMAN_AUTHORIZATION";
  requirePass(Boolean(AUTOMATION_PROFILES[profile]), "Merge profile is unknown.");
  requirePass(new Set(["Low", "Medium", "High"]).has(risk), "Merge risk is unknown.");
  if (!automaticLowRisk) {
    requirePass(authorization.status === "APPROVED", "Human merge authorization is missing.");
    requirePass(hasText(authorization.human_identity), "Human merge authorization lacks a named identity.");
    requirePass(validRunUrl(authorization.admission_report_url) || /^https:\/\/[^/]+\/.+/.test(authorization.admission_report_url ?? ""), "Human merge authorization lacks an admission report URL.");
    requirePass(hasText(authorization.repository) && authorization.repository === pr.repository, "Human authorization is not bound to this repository.");
    requirePass(Number.isInteger(authorization.pr) && authorization.pr === pr.number, "Human authorization is not bound to this PR.");
    requirePass(hasText(authorization.head_sha) && authorization.head_sha === pr.head_sha, "Human authorization is not bound to the exact head SHA.");
    requirePass(/^[0-9a-f]{40}$/.test(authorization.base_sha ?? "") && authorization.base_sha === current_base_sha, "Human authorization is not bound to the current base SHA.");
    requirePass(/^[0-9a-f]{64}$/.test(authorization.admission_report_digest ?? "") && authorization.admission_report_digest === admission.report_digest, "Human authorization is not bound to the exact admission report digest.");
    requirePass(hasText(authorization.valid_until) && hasText(now) && Date.parse(authorization.valid_until) > Date.parse(now), "Human merge authorization is missing, invalid, or expired.");
  }
  requirePass(admission.status === "PASS" && admission.commit_sha === pr.head_sha && hasText(admission.source_id) && /^[0-9a-f]{64}$/.test(admission.report_digest ?? ""), "Fresh independent admission PASS is missing for the PR head SHA.");
  requirePass(admission.base_sha === current_base_sha, "The base branch advanced; synchronize and repeat CI, review, QA, admission, and human approval.");
  requirePass(pr.checks === "PASS", "Required PR checks are not passing.");
  requirePass(pr.unresolved_threads === 0, "Unresolved review threads remain.");
  requirePass(unresolved_dependencies.length === 0, "Blocking issue dependencies remain unresolved.");
  return {
    authorize_merge: blockers.length === 0,
    expected_head_sha: blockers.length === 0 ? pr.head_sha : null,
    merge_mode: mergeMode,
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
