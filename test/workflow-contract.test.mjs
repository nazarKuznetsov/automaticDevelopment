import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityProfile,
  classifyFinding,
  evaluateClaimStaleness,
  evaluateAdmission,
  evaluateMaterializationReport,
  evaluateMerge,
  evaluateReadiness,
  evaluateReviewTopology,
  evaluateWorkerLaunch,
  materializeApprovedPlan,
  orchestratorControl,
  planRollingWave,
  postMergeReconciliation,
  postPrRecovery,
  selectLaunchableIssues,
} from "../kit/repo/.codex/scripts/workflow-contract.mjs";

const readyFields = {
  plan_item_id: "mvp.core-journey.export-report",
  goal: "A signed-in user can export a report.",
  merge_outcome: "One PR adds the independently testable CSV export journey.",
  acceptance: "Given a report, when Export is selected, then a CSV downloads.",
  validation: "npm test -- export",
  integration_validation: "npm test -- export-integration",
  integration_order: "1",
  primary_signal: "A CSV downloads with the visible report rows.",
  owner_layer: "report export service",
  conflict_keys: "request-contract, report-export",
  touch_points: "Export route, CSV serializer, export contract tests",
  reviewers: "reviewer, qa, admission-reviewer",
  out_of_scope: "PDF export",
  priority: "P1",
  risk: "Medium",
  size: "S",
  phase: "MVP",
  work_type: "Task",
  qa_required: "Yes",
};

function passingAdmission(overrides = {}) {
  const sha = "abc1234abc1234abc1234abc1234abc1234abc12";
  const evidence = (source, observed) => ({ source, observed });
  const review = (id) => ({
    status: "PASS",
    commit_sha: sha,
    source: { kind: "agent_task", id },
    evidence: [evidence(`task:${id}`, "Reviewed the exact diff and acceptance evidence; no blockers found.")],
  });
  return {
    schema_version: 2,
    packet_type: "pre_pr_admission",
    commit_sha: sha,
    current_sha: sha,
    base_sha_at_launch: "def5678def5678def5678def5678def5678def56",
    validated_base_sha: "def5678def5678def5678def5678def5678def56",
    current_base_sha: "def5678def5678def5678def5678def5678def56",
    current_branch: "agent/1-export-report",
    qa_tracked_worktree: { status: "CLEAN", before: "", after: "" },
    gate_tracked_worktree: { status: "CLEAN", before: "", after: "" },
    configured_validation: {
      targeted: ["npm test -- export"],
      full: ["npm test"],
      integration: ["npm test -- export-integration"],
      branch_ci_workflow: "agent-branch-validation.yml",
    },
    worker: { source: { kind: "agent_task", id: "worker-task-1" } },
    issue: { number: 1, is_leaf: true, risk: "Medium", high_risk_flags: [], unresolved_dependencies: [] },
    acceptance: { passed: true, evidence: [evidence("browser:artifact-1", "CSV downloaded with the visible ordered rows.")] },
    tdd: {
      status: "PASS",
      red: { command: "npm test -- export", exit_code: 1, observed: "Expected CSV download but none was produced." },
      green: { command: "npm test -- export", exit_code: 0, observed: "Export contract test passed." },
    },
    local_validation: {
      targeted: { status: "PASS", commit_sha: sha, commands: [{ command: "npm test -- export", exit_code: 0, observed: "Targeted export suite passed." }] },
      full: { status: "PASS", commit_sha: sha, commands: [{ command: "npm test", exit_code: 0, observed: "Full suite passed." }] },
      integration: { status: "PASS", commit_sha: sha, commands: [{ command: "npm test -- export-integration", exit_code: 0, observed: "Export integration suite passed." }] },
    },
    reviews: {
      reviewer: review("reviewer-task-1"),
      qa: review("qa-task-1"),
      admission: review("admission-task-1"),
      design: { status: "NOT_REQUIRED", reason: "No UI or accessibility surface changed." },
      security: { status: "NOT_REQUIRED", reason: "No auth, data, or security surface changed." },
    },
    branch_ci: { status: "PASS", commit_sha: sha, workflow: "agent-branch-validation.yml", run_url: "https://github.com/example/repo/actions/runs/123" },
    baseline: { new_failures: [], affected_failures: [], legacy_failures: [] },
    documentation: { status: "PASS", evidence: [evidence("diff:README.md", "User-facing workflow documentation is aligned.")] },
    rollout: { status: "NOT_REQUIRED", reason: "No migration, deployment, or rollout behavior changed." },
    human_gates: { status: "CLEAR", reason: "No unresolved gate remains; human merge approval is still required." },
    ...overrides,
  };
}

test("capability profiles keep organization-only features optional", () => {
  assert.deepEqual(capabilityProfile("personal"), {
    issue_types: false,
    merge_queue: false,
    work_type_fallback: true,
  });
  assert.deepEqual(capabilityProfile("organization"), {
    issue_types: false,
    merge_queue: false,
    work_type_fallback: true,
  });
  assert.deepEqual(capabilityProfile("organization", { issue_types: true, merge_queue: false }), {
    issue_types: true,
    merge_queue: false,
    work_type_fallback: true,
  });
});

test("rolling-wave plan keeps all phases but details only the current wave", () => {
  const roadmap = planRollingWave({
    current_phase: "MVP",
    phases: [
      { name: "Discovery", epics: ["Problem contract"] },
      { name: "Planning", epics: ["Architecture"] },
      { name: "Design", epics: ["UX system"] },
      { name: "Foundation", epics: ["Delivery skeleton"] },
      {
        name: "MVP",
        epics: ["Core journey"],
        candidates: Array.from({ length: 7 }, (_, index) => ({
          id: index + 1,
          title: `Export slice ${index + 1}`,
          parent_plan_item_id: "mvp.core-journey",
          is_leaf: true,
          size: "S",
          blocked: false,
          priority: index < 2 ? "P0" : "P1",
          merge_outcome: `Merge export slice ${index + 1}.`,
          primary_signal: `Export slice ${index + 1} is observable.`,
          acceptance: ["Criterion 1", "Criterion 2", "Criterion 3"],
          owner_layer: `owner-${index + 1}`,
          conflict_keys: [`surface-${index + 1}`],
          touch_points: [`src/export-${index + 1}.js`],
          dependencies: [],
          integration_order: index + 1,
          validation: { targeted: ["npm test"], full: ["npm test"], integration: ["npm test"] },
          reviewers: ["reviewer", "qa", "admission-reviewer"],
          human_gates: ["merge"],
          out_of_scope: ["Unrelated export formats"],
        })),
      },
      { name: "Stabilization", epics: ["Quality"] },
      { name: "Production", epics: ["Operations"] },
      { name: "Growth", epics: ["Next outcomes"] },
    ],
  });

  assert.equal(roadmap.phases.length, 8);
  assert.equal(roadmap.current_wave.length, 5);
  assert.equal(roadmap.phases.find((phase) => phase.name === "MVP").detail, "executable");
  assert.equal(roadmap.phases.find((phase) => phase.name === "Stabilization").detail, "draft");
  assert.equal(roadmap.phases.find((phase) => phase.name === "Production").detail, "roadmap");
  assert.match(roadmap.current_wave[0].plan_item_id, /^mvp\./);
  assert.equal(roadmap.current_wave[0].acceptance.length, 3);
  assert.deepEqual(roadmap.current_wave[0].conflict_keys, ["surface-1"]);
});

test("planner assigns deterministic stable IDs and rejects incomplete merge units", () => {
  const candidate = {
    title: "Export signed report",
    parent_plan_item_id: "mvp.core-journey",
    is_leaf: true,
    size: "S",
    blocked: false,
    priority: "P1",
    merge_outcome: "One PR adds signed report export.",
    primary_signal: "A signed report downloads.",
    acceptance: ["One", "Two", "Three"],
    owner_layer: "report-export",
    conflict_keys: ["request-contract"],
    touch_points: ["src/report.ts"],
    dependencies: [],
    integration_order: 1,
    validation: { targeted: ["npm test -- report"], full: ["npm test"], integration: ["npm test -- integration"] },
    reviewers: ["reviewer", "qa", "admission-reviewer"],
    human_gates: ["merge"],
    out_of_scope: ["PDF export"],
  };
  const input = { current_phase: "MVP", phases: [{ name: "MVP", candidates: [candidate, { ...candidate, title: "Incomplete", conflict_keys: [] }] }] };
  const first = planRollingWave(input);
  const second = planRollingWave(input);
  assert.equal(first.current_wave.length, 1);
  assert.equal(first.current_wave[0].plan_item_id, second.current_wave[0].plan_item_id);
  assert.equal(first.rejected_candidates[0].title, "Incomplete");
  assert.match(first.rejected_candidates[0].reasons.join(" "), /conflict_keys/);
});

test("approved plan materialization is top-down and idempotent", () => {
  const packet = {
    revision: "phase-plan-r3",
    approval: { status: "APPROVED", revision: "phase-plan-r3" },
    hierarchy: [
      { plan_item_id: "mvp.epic", parent_plan_item_id: null, title: "MVP Epic", work_type: "Epic" },
      { plan_item_id: "mvp.epic.export", parent_plan_item_id: "mvp.epic", title: "Export", work_type: "Task" },
    ],
    ready_wave: [{ plan_item_id: "mvp.epic.export", parent_plan_item_id: "mvp.epic", title: "Export", conflict_keys: ["report-export"] }],
    dependencies: [{ blocked: "mvp.epic.export", blocking: "foundation.api" }],
  };
  const first = materializeApprovedPlan(packet, { mapping: { "foundation.api": "https://github.com/acme/app/issues/2" }, resolved_plan_items: ["foundation.api"], relationships: [] });
  assert.deepEqual(first.issue_creates.map((item) => item.plan_item_id), ["mvp.epic", "mvp.epic.export"]);
  assert.equal(first.requires_read_after_write, true);
  assert.deepEqual(first.agent_ready_candidates, ["mvp.epic.export"]);

  const second = materializeApprovedPlan(packet, {
    mapping: {
      "foundation.api": "https://github.com/acme/app/issues/2",
      "mvp.epic": "https://github.com/acme/app/issues/10",
      "mvp.epic.export": "https://github.com/acme/app/issues/11",
    },
    resolved_plan_items: ["foundation.api"],
    relationships: ["parent:mvp.epic>mvp.epic.export", "dependency:foundation.api>mvp.epic.export"],
  });
  assert.deepEqual(second.issue_creates, []);
  assert.deepEqual(second.relationship_creates, []);

  assert.throws(
    () => materializeApprovedPlan({ ...packet, ready_wave: [{ ...packet.ready_wave[0], plan_item_id: "mvp.orphan" }] }),
    /must appear in hierarchy/,
  );
  assert.throws(
    () => materializeApprovedPlan({ ...packet, ready_wave: [{ ...packet.ready_wave[0], parent_plan_item_id: "mvp.ghost" }] }, { resolved_plan_items: ["foundation.api"] }),
    /parent does not match/,
  );
  assert.throws(
    () => materializeApprovedPlan(packet, { mapping: { "foundation.api": "https://github.com/acme/app/issues/2" } }),
    /unresolved dependencies/,
  );
});

test("materialization PASS requires complete mapping and native readback", () => {
  const packet = {
    revision: "phase-plan-r4",
    hierarchy: [
      { plan_item_id: "mvp.epic", parent_plan_item_id: null },
      { plan_item_id: "mvp.epic.export", parent_plan_item_id: "mvp.epic" },
    ],
    dependencies: [],
    ready_wave: [{ plan_item_id: "mvp.epic.export" }],
  };
  const incomplete = evaluateMaterializationReport(packet, {
    phase_plan_revision: "phase-plan-r4",
    status: "PASS",
    mapping: [], hierarchy_readback: [], dependency_readback: [], project_readback: [], agent_ready_readback: [], blockers: [],
  });
  assert.equal(incomplete.valid, false);
  const complete = evaluateMaterializationReport(packet, {
    phase_plan_revision: "phase-plan-r4",
    status: "PASS",
    mapping: [
      { plan_item_id: "mvp.epic", issue_number: 10, issue_url: "https://github.com/acme/app/issues/10" },
      { plan_item_id: "mvp.epic.export", issue_number: 11, issue_url: "https://github.com/acme/app/issues/11" },
    ],
    hierarchy_readback: [{ parent_plan_item_id: "mvp.epic", child_plan_item_id: "mvp.epic.export", observed: true }],
    dependency_readback: [],
    project_readback: [
      { plan_item_id: "mvp.epic", project_item_id: "PVTI_10", status: "Backlog", observed: true },
      { plan_item_id: "mvp.epic.export", project_item_id: "PVTI_11", status: "Ready", observed: true },
    ],
    agent_ready_readback: [{ plan_item_id: "mvp.epic.export", issue_url: "https://github.com/acme/app/issues/11", label_present: true, status: "Ready" }],
    blockers: [],
  });
  assert.deepEqual(complete, { valid: true, blockers: [] });
});

test("readiness rejects parents, L/XL work, blockers, and empty issue-form values", () => {
  const parent = evaluateReadiness({ fields: readyFields, has_sub_issues: true, unresolved_dependencies: [] });
  assert.equal(parent.ready, false);
  assert.ok(parent.reasons.includes("Only leaf issues can be agent-ready."));

  const large = evaluateReadiness({ fields: { ...readyFields, size: "L" }, has_sub_issues: false, unresolved_dependencies: [] });
  assert.equal(large.ready, false);
  assert.ok(large.reasons.includes("L and XL issues must be decomposed before execution."));

  const blocked = evaluateReadiness({ fields: readyFields, has_sub_issues: false, unresolved_dependencies: [42] });
  assert.equal(blocked.ready, false);
  assert.ok(blocked.reasons.includes("Resolve native issue dependencies before Ready."));

  const empty = evaluateReadiness({ fields: { ...readyFields, acceptance: "  " }, has_sub_issues: false, unresolved_dependencies: [] });
  assert.equal(empty.ready, false);
  assert.ok(empty.reasons.includes("Missing required value: acceptance."));
});

test("readiness passes a complete, unblocked leaf issue", () => {
  assert.deepEqual(
    evaluateReadiness({ fields: readyFields, has_sub_issues: false, unresolved_dependencies: [] }),
    { ready: true, reasons: [] },
  );
});

test("launch selection parallelizes only disjoint conflict keys", () => {
  const candidates = [
    { id: 1, ready: true, is_leaf: true, size: "S", conflict_keys: ["frontend-router"] },
    { id: 2, ready: true, is_leaf: true, size: "XS", conflict_keys: ["schema"] },
    { id: 3, ready: true, is_leaf: true, size: "S", conflict_keys: ["frontend-router", "shared-css"] },
  ];
  const selection = selectLaunchableIssues({ candidates, active_workers: [], max_workers: 2 });
  assert.deepEqual(selection.selected.map((item) => item.id), [1, 2]);
  assert.equal(selection.deferred.find((item) => item.id === 3).reason, "CONFLICT_KEY_OVERLAP");

  const withActive = selectLaunchableIssues({
    candidates,
    active_workers: [{ id: 8, conflict_keys: ["schema"] }],
    max_workers: 2,
  });
  assert.deepEqual(withActive.selected.map((item) => item.id), [1]);
  const malformed = selectLaunchableIssues({ candidates: [{ id: 9, ready: true, is_leaf: true, size: "S", conflict_keys: ["Request Contract"] }] });
  assert.equal(malformed.deferred[0].reason, "MALFORMED_CONFLICT_KEYS");
});

test("worker launch counts only a verified top-level managed-worktree task", () => {
  assert.deepEqual(evaluateWorkerLaunch({ result: { status: "QUEUED", client_task_id: "client-1" } }), {
    state: "CREATING",
    count_launch: false,
    keep_claim: true,
    next_action: "VERIFY_CANONICAL_TASK",
  });
  assert.equal(evaluateWorkerLaunch({ result: {
    status: "CREATED",
    task_id: "task-1",
    task_readback: { id: "task-1", kind: "top_level", state: "READY", observed: true, source: "codex_task_readback" },
    worktree: { id: "wt-1", task_id: "task-1", managed: true, state: "READY", observed: true, source: "codex_worktree_readback" },
  } }).count_launch, true);
  const taskReadback = (id, kind = "top_level") => ({ id, kind, state: "READY", observed: true, source: "codex_task_readback" });
  const worktreeReadback = (taskId, id) => ({ id, task_id: taskId, managed: true, state: "READY", observed: true, source: "codex_worktree_readback" });
  assert.equal(evaluateWorkerLaunch({ result: { status: "CREATED", task_id: "task-2", task_readback: taskReadback("task-2", "fork"), worktree: worktreeReadback("task-2", "wt-2") } }).state, "REJECTED");
  assert.equal(evaluateWorkerLaunch({ result: { status: "CREATED", task_id: "task-3", task_readback: taskReadback("task-3"), worktree: worktreeReadback("task-3", "wt-3"), worktree_path: "/private/tmp/w" } }).state, "REJECTED");
  assert.equal(evaluateWorkerLaunch({ result: { status: "CREATED", task_id: "task-4", task_readback: taskReadback("task-4") } }).state, "REJECTED");
  assert.equal(evaluateWorkerLaunch({ result: { status: "CREATED", task_id: "task-5", task_readback: { ...taskReadback("task-5"), observed: false }, worktree: worktreeReadback("task-5", "wt-5") } }).state, "REJECTED");
  assert.equal(evaluateWorkerLaunch({ result: { status: "FAILED" } }).keep_claim, false);
  assert.equal(evaluateWorkerLaunch({ result: { status: "AMBIGUOUS" } }).next_action, "QUERY_BEFORE_RETRY");
});

test("claim is stale only after task absence and three missed heartbeats without branch or PR", () => {
  assert.equal(evaluateClaimStaleness({ task_found: false, missed_heartbeats: 3, branch_exists: false, pr_exists: false }).stale, true);
  assert.equal(evaluateClaimStaleness({ task_found: true, missed_heartbeats: 9, branch_exists: false, pr_exists: false }).stale, false);
  assert.equal(evaluateClaimStaleness({ task_found: false, missed_heartbeats: 3, branch_exists: true, pr_exists: false }).stale, false);
  assert.equal(evaluateClaimStaleness({ task_found: false, missed_heartbeats: 3, branch_exists: false, pr_exists: true }).stale, false);
});

test("worker review topology enforces depth, concurrency, non-authoring QA, and distinct identities", () => {
  const valid = evaluateReviewTopology({
    worker_id: "worker-1",
    agents: [
      { id: "reviewer-1", role: "reviewer", depth: 1, active: true, tracked_writes: false },
      { id: "qa-1", role: "qa", depth: 1, active: true, tracked_writes: false },
      { id: "admission-1", role: "admission-reviewer", depth: 1, active: false, tracked_writes: false },
    ],
  });
  assert.equal(valid.valid, true);

  const invalid = evaluateReviewTopology({
    worker_id: "worker-1",
    agents: [
      { id: "same", role: "reviewer", depth: 1, active: true, tracked_writes: false },
      { id: "same", role: "qa", depth: 2, active: true, tracked_writes: true },
      { id: "same", role: "admission-reviewer", depth: 1, active: true, tracked_writes: false },
    ],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.reasons.some((reason) => /depth/.test(reason)));
  assert.ok(invalid.reasons.some((reason) => /two active/.test(reason)));
  assert.ok(invalid.reasons.some((reason) => /tracked changes/.test(reason)));
  assert.ok(invalid.reasons.some((reason) => /distinct/.test(reason)));
});

test("finding loop distinguishes in-scope, independent, duplicate, and high-risk findings", () => {
  assert.equal(classifyFinding({ within_scope: true, severity: "Medium" }).action, "RETURN_TO_WORKER");
  assert.equal(classifyFinding({ duplicate_issue: 17, severity: "Low" }).action, "LINK_DUPLICATE");
  assert.equal(classifyFinding({ within_scope: false, severity: "Medium", evidence_complete: true }).action, "CREATE_BUG");
  assert.equal(classifyFinding({ within_scope: false, severity: "High", evidence_complete: true }).action, "HUMAN_ACTION_REQUIRED");
  assert.equal(classifyFinding({ within_scope: true, severity: "High", evidence_complete: true }).action, "HUMAN_ACTION_REQUIRED");
  assert.equal(classifyFinding({ within_scope: false, severity: "Unknown", evidence_complete: true }).action, "REQUEST_EVIDENCE");
  assert.equal(classifyFinding({ within_scope: false, severity: "Low", evidence_complete: false }).action, "REQUEST_EVIDENCE");
});

test("admission rejects branch CI failure and never authorizes a PR", () => {
  const report = evaluateAdmission(passingAdmission({ branch_ci: { status: "FAIL", commit_sha: "abc1234abc1234abc1234abc1234abc1234abc12", workflow: "agent-branch-validation.yml", run_url: "https://github.com/example/repo/actions/runs/124" } }));
  assert.equal(report.status, "FAIL");
  assert.equal(report.authorize_pr, false);
  assert.ok(report.blockers.includes("Branch CI lacks a matching workflow run URL for the current commit SHA."));
});

test("admission rejects a new regression but accepts a proven legacy baseline issue", () => {
  const regression = evaluateAdmission(passingAdmission({ baseline: { new_failures: ["lint"], affected_failures: [], legacy_failures: [] } }));
  assert.equal(regression.authorize_pr, false);

  const legacy = evaluateAdmission(passingAdmission({
    baseline: {
      new_failures: [],
      affected_failures: [],
      legacy_failures: [{
        signal: "unrelated e2e",
        issue: 91,
        proven_pre_existing: true,
        base_sha: "def5678def5678def5678def5678def5678def56",
        evidence: [{ source: "base-run:91", observed: "The same e2e failure occurs on the base SHA." }],
      }],
    },
  }));
  assert.equal(legacy.status, "PASS");
  assert.equal(legacy.authorize_pr, true);
  assert.equal(legacy.commit_sha, "abc1234abc1234abc1234abc1234abc1234abc12");
});

test("admission rejects self-review, vague PASS strings, and command drift", () => {
  const base = passingAdmission();
  const report = evaluateAdmission(passingAdmission({
    reviews: {
      ...base.reviews,
      reviewer: { ...base.reviews.reviewer, source: { kind: "agent_task", id: "worker-task-1" } },
    },
    local_validation: {
      ...base.local_validation,
      targeted: { ...base.local_validation.targeted, commands: [{ command: "npm test -- other", exit_code: 0, observed: "Different suite passed." }] },
    },
  }));
  assert.equal(report.authorize_pr, false);
  assert.ok(report.blockers.some((item) => item.includes("Independent reviewer")));
  assert.ok(report.blockers.some((item) => item.includes("exact configured commands")));
});

test("admission rejects dirty tracked state, reused admission identity, and advanced base", () => {
  const base = passingAdmission();
  const report = evaluateAdmission(passingAdmission({
    current_base_sha: "9999999999999999999999999999999999999999",
    qa_tracked_worktree: { status: "DIRTY", before: " M src/app.js", after: " M src/app.js" },
    reviews: {
      ...base.reviews,
      admission: { ...base.reviews.admission, source: { kind: "agent_task", id: "reviewer-task-1" } },
    },
  }));
  assert.equal(report.authorize_pr, false);
  assert.ok(report.blockers.some((item) => /validated base is stale/.test(item)));
  assert.ok(report.blockers.some((item) => /tracked worktree/.test(item)));
  assert.ok(report.blockers.some((item) => /Admission reviewer/.test(item)));
});

test("admission fails closed when required risk metadata is omitted", () => {
  const base = passingAdmission();
  const report = evaluateAdmission(passingAdmission({ issue: { number: 1, is_leaf: true, unresolved_dependencies: [] } }));
  assert.equal(report.authorize_pr, false);
  assert.ok(report.blockers.some((item) => /risk and high-risk flags/.test(item)));
  assert.ok(report.blockers.some((item) => /top-level review task/.test(item)));
  assert.equal(base.issue.risk, "Medium");
});

test("high-risk admission requires a separate top-level review task", () => {
  const base = passingAdmission();
  const security = {
    ...base.reviews.reviewer,
    source: { kind: "agent_task", id: "security-task-1", scope: "direct_subagent" },
  };
  const direct = evaluateAdmission(passingAdmission({
    issue: { ...base.issue, risk: "High", high_risk_flags: ["security"] },
    reviews: { ...base.reviews, security },
  }));
  assert.equal(direct.authorize_pr, false);
  assert.ok(direct.blockers.some((item) => /separate top-level review task/.test(item)));

  const topLevel = evaluateAdmission(passingAdmission({
    issue: { ...base.issue, risk: "High", high_risk_flags: ["security"] },
    reviews: { ...base.reviews, security: { ...security, source: { ...security.source, scope: "top_level_task" } } },
  }));
  assert.equal(topLevel.authorize_pr, true);
});

test("full admission pass authorizes exactly one PR for one SHA", () => {
  const first = evaluateAdmission(passingAdmission());
  const replay = evaluateAdmission(passingAdmission({
    existing_pr_for_sha: {
      number: 123,
      url: "https://github.com/example/repo/pull/123",
      commit_sha: "abc1234abc1234abc1234abc1234abc1234abc12",
    },
  }));
  assert.equal(first.authorize_pr, true);
  assert.equal(first.pr_action, "CREATE_ONCE");
  assert.equal(replay.authorize_pr, false);
  assert.equal(replay.pr_action, "USE_EXISTING");
});

test("human blocker yields Blocked without PR", () => {
  const report = evaluateAdmission(passingAdmission({ human_gates: { status: "BLOCKED", reason: "Migration approval" } }));
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.issue_status, "Blocked");
  assert.equal(report.authorize_pr, false);
});

test("post-PR failure returns the same PR to Draft and issue to In Progress", () => {
  assert.deepEqual(postPrRecovery({ pr: 27, signal: "REQUESTED_CHANGES" }), {
    pr: 27,
    convert_to_draft: true,
    issue_status: "In Progress",
    reuse_branch_and_pr: true,
  });
});

test("orchestrator pauses idle heartbeat and requires handoff after five launches", () => {
  assert.deepEqual(orchestratorControl({ queue_length: 0, awaiting_human: false, launches: 2 }), {
    heartbeat: "PAUSE",
    handoff: "NOT_REQUIRED",
  });
  assert.deepEqual(orchestratorControl({ queue_length: 1, awaiting_human: false, launches: 5 }), {
    heartbeat: "ACTIVE",
    handoff: "REQUIRED",
  });
  assert.equal(orchestratorControl({ queue_length: 1, awaiting_human: true, launches: 1 }).heartbeat, "PAUSE");
});

test("merge requires exact human-approved PR and SHA plus fresh admission and base", () => {
  const input = {
    now: "2026-07-14T12:00:00.000Z",
    authorization: {
      status: "APPROVED",
      human_identity: "product-owner@example.invalid",
      repository: "acme/app",
      admission_report_url: "https://github.com/acme/app/issues/19#issuecomment-1",
      admission_report_digest: "d".repeat(64),
      pr: 19,
      head_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      base_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      valid_until: "2026-07-15T12:00:00.000Z",
    },
    pr: { repository: "acme/app", number: 19, head_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", unresolved_threads: 0, checks: "PASS" },
    admission: { status: "PASS", commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", base_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", source_id: "admission-1", report_digest: "d".repeat(64) },
    current_base_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    unresolved_dependencies: [],
  };
  const pass = evaluateMerge(input);
  assert.equal(pass.authorize_merge, true);
  assert.equal(pass.expected_head_sha, input.pr.head_sha);

  const staleSha = evaluateMerge({ ...input, pr: { ...input.pr, head_sha: "cccccccccccccccccccccccccccccccccccccccc" } });
  assert.equal(staleSha.authorize_merge, false);
  assert.ok(staleSha.blockers.some((item) => /exact head SHA/.test(item)));

  const staleBase = evaluateMerge({ ...input, current_base_sha: "dddddddddddddddddddddddddddddddddddddddd" });
  assert.equal(staleBase.authorize_merge, false);
  assert.ok(staleBase.blockers.some((item) => /base branch advanced/.test(item)));

  const refreshedAdmissionWithoutHumanReapproval = evaluateMerge({
    ...input,
    current_base_sha: "dddddddddddddddddddddddddddddddddddddddd",
    admission: { ...input.admission, base_sha: "dddddddddddddddddddddddddddddddddddddddd" },
  });
  assert.equal(refreshedAdmissionWithoutHumanReapproval.authorize_merge, false);
  assert.ok(refreshedAdmissionWithoutHumanReapproval.blockers.some((item) => /authorization is not bound to the current base SHA/.test(item)));

  const changedAdmission = evaluateMerge({ ...input, admission: { ...input.admission, report_digest: "e".repeat(64) } });
  assert.equal(changedAdmission.authorize_merge, false);
  assert.ok(changedAdmission.blockers.some((item) => /exact admission report digest/.test(item)));
});

test("post-merge reconciliation marks Done and archives only after green post-merge CI", () => {
  const merge = { status: "MERGED", pr: 19, head_sha: "a".repeat(40), merge_commit_sha: "b".repeat(40), url: "https://github.com/acme/app/pull/19" };
  const ci = { status: "PASS", commit_sha: "b".repeat(40), workflow: "main-ci.yml", run_url: "https://github.com/acme/app/actions/runs/123" };
  assert.deepEqual(postMergeReconciliation({ merge_readback: merge, post_merge_ci: ci, blocking_findings: [] }), {
    issue_status: "Done",
    archive_worker: true,
    create_blocking_bug: false,
  });
  assert.deepEqual(postMergeReconciliation({ merge_readback: merge, post_merge_ci: { ...ci, status: "FAIL" }, blocking_findings: [] }), {
    issue_status: "Review",
    archive_worker: false,
    create_blocking_bug: true,
  });
  assert.equal(postMergeReconciliation({ merge_readback: merge, post_merge_ci: { ...ci, commit_sha: "c".repeat(40) } }).archive_worker, false);
  assert.equal(postMergeReconciliation({ merge_readback: "MERGED", post_merge_ci: "PASS" }).archive_worker, false);
});
