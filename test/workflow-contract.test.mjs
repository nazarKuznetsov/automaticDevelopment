import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityProfile,
  classifyFinding,
  evaluateAdmission,
  evaluateReadiness,
  orchestratorControl,
  planRollingWave,
  postPrRecovery,
} from "../kit/repo/.codex/scripts/workflow-contract.mjs";

const readyFields = {
  goal: "A signed-in user can export a report.",
  acceptance: "Given a report, when Export is selected, then a CSV downloads.",
  validation: "npm test -- export",
  primary_signal: "A CSV downloads with the visible report rows.",
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
    current_branch: "agent/1-export-report",
    configured_validation: {
      targeted: ["npm test -- export"],
      full: ["npm test"],
      branch_ci_workflow: "agent-branch-validation.yml",
    },
    worker: { source: { kind: "agent_task", id: "worker-task-1" } },
    issue: { number: 1, is_leaf: true, unresolved_dependencies: [] },
    acceptance: { passed: true, evidence: [evidence("browser:artifact-1", "CSV downloaded with the visible ordered rows.")] },
    tdd: {
      status: "PASS",
      red: { command: "npm test -- export", exit_code: 1, observed: "Expected CSV download but none was produced." },
      green: { command: "npm test -- export", exit_code: 0, observed: "Export contract test passed." },
    },
    local_validation: {
      targeted: { status: "PASS", commit_sha: sha, commands: [{ command: "npm test -- export", exit_code: 0, observed: "Targeted export suite passed." }] },
      full: { status: "PASS", commit_sha: sha, commands: [{ command: "npm test", exit_code: 0, observed: "Full suite passed." }] },
    },
    reviews: {
      reviewer: review("reviewer-task-1"),
      qa: review("qa-task-1"),
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
          is_leaf: true,
          size: "S",
          blocked: false,
          priority: index < 2 ? "P0" : "P1",
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
