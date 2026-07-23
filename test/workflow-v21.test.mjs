import assert from "node:assert/strict";
import test from "node:test";

import {
  automationProfile,
  buildMaterializationJournal,
  classifyTouchOwnership,
  evaluateAuthorityLease,
  evaluateRepositoryIdentity,
  evaluateSourceMaintenanceProgress,
  evaluateWorkerPreflight,
  orchestratorControl,
  reviewTopologyForRisk,
  routeManagedChange,
} from "../kit/repo/.codex/scripts/workflow-contract.mjs";

test("repository identity requires config, remote, packet, and Issue to name one execution target", () => {
  const identity = {
    config_repository: "owner/product-repo",
    remote_repository: "owner/product-repo",
    packet_repository: "owner/product-repo",
    issue_repository: "owner/product-repo",
  };
  assert.deepEqual(evaluateRepositoryIdentity(identity), {
    valid: true,
    repository: "owner/product-repo",
    blockers: [],
  });

  const wrongPacket = evaluateRepositoryIdentity({
    ...identity,
    packet_repository: "owner/automation-kit",
  });
  assert.equal(wrongPacket.valid, false);
  assert.match(wrongPacket.blockers.join(" "), /packet_repository/);
});

test("touch ownership blocks unknown paths and routes managed core before Worker launch", () => {
  const manifest_files = [
    { path: ".codex/scripts/workflow-contract.mjs", ownership: "managed" },
    { path: ".codex/agent-workflow.json", ownership: "host" },
    { path: "generated/client.ts", ownership: "generated" },
  ];
  const classified = classifyTouchOwnership({
    touch_points: [
      ".codex/scripts/workflow-contract.mjs",
      ".codex/agent-workflow.json",
      "generated/client.ts",
    ],
    manifest_files,
  });
  assert.equal(classified.valid, true);
  assert.equal(classified.scope, "mixed");
  assert.deepEqual(classified.managed, [".codex/scripts/workflow-contract.mjs"]);
  assert.deepEqual(classified.host, [".codex/agent-workflow.json"]);
  assert.deepEqual(classified.generated, ["generated/client.ts"]);

  const unknown = classifyTouchOwnership({
    touch_points: ["src/unclassified.ts"],
    manifest_files,
  });
  assert.equal(unknown.valid, false);
  assert.deepEqual(unknown.unknown, ["src/unclassified.ts"]);

  const route = routeManagedChange({
    classification: classified,
    policy: "route_to_source",
    source_access: true,
    source_repository: "owner/automation-kit",
    target_repository: "owner/product-repo",
    source_issue: { repository: "owner/product-repo", number: 22 },
    summary: "Materialization must preserve advanced lifecycle state.",
  });
  assert.equal(route.action, "AUTO_ROUTE");
  assert.equal(route.launch_target_worker, false);
  assert.equal(route.maintenance_packet.repository, "owner/automation-kit");
  assert.deepEqual(route.maintenance_packet.target_adoption, {
    host_paths: [".codex/agent-workflow.json"],
    generated_paths: ["generated/client.ts"],
  });
  assert.match(route.maintenance_packet.fingerprint, /^[0-9a-f]{64}$/);

  const unavailable = routeManagedChange({
    classification: classified,
    policy: "route_to_source",
    source_access: false,
    source_repository: "third-party/automation-kit",
    target_repository: "owner/product-repo",
    source_issue: { repository: "owner/product-repo", number: 22 },
    summary: "Materialization must preserve advanced lifecycle state.",
  });
  assert.equal(unavailable.action, "BLOCK_AND_REPORT");
  assert.equal(unavailable.launch_target_worker, false);
});

test("Worker preflight prevents target launch for managed, generated, and unknown touch points", () => {
  const manifest_files = [
    { path: ".codex/scripts/workflow-contract.mjs", ownership: "managed" },
    { path: "generated/client.ts", ownership: "generated" },
  ];
  const authority_lease = {
    authority_id: "wave-authority-2026-01",
    profile: "solo_fast",
    repositories: ["owner/product-repo", "owner/automation-kit"],
    plan_revision: "phase-plan-r5",
    plan_item_ids: ["mvp.product"],
    issue_ids: [22],
    allowed_actions: ["create_worker", "create_source_maintenance"],
    max_worker_launches: 5,
    max_github_writes: 100,
    expires_at: "2099-01-01T00:00:00.000Z",
    approved_by: "product-owner",
  };
  const basePacket = {
    repository: "owner/product-repo",
    plan_item_id: "mvp.product",
    repository_identity: {
      config_repository: "owner/product-repo",
      remote_repository: "owner/product-repo",
      packet_repository: "owner/product-repo",
      issue_repository: "owner/product-repo",
    },
    touch_points: ["src/product.ts"],
    allowed_paths: ["src/product.ts"],
    touch_ownership: {
      scope: "host",
      managed: [],
      host: ["src/product.ts"],
      generated: [],
      unknown: [],
    },
    managed_change_policy: "route_to_source",
    kit_source_binding: {
      source_repository: "owner/automation-kit",
      source_commit: "a".repeat(40),
    },
    authority_lease,
    issue: 22,
    summary: "Deliver one product slice.",
  };
  assert.equal(evaluateWorkerPreflight({
    worker_packet: basePacket,
    manifest_files,
    source_access: true,
  }).action, "ALLOW_TARGET_WORKER");

  const managed = evaluateWorkerPreflight({
    worker_packet: {
      ...basePacket,
      touch_points: [".codex/scripts/workflow-contract.mjs"],
      allowed_paths: [".codex/scripts/workflow-contract.mjs"],
      touch_ownership: {
        scope: "managed",
        managed: [".codex/scripts/workflow-contract.mjs"],
        host: [],
        generated: [],
        unknown: [],
      },
    },
    manifest_files,
    source_access: true,
  });
  assert.equal(managed.action, "SOURCE_REPAIR_REQUIRED");
  assert.equal(managed.launch_target_worker, false);
  assert.equal(managed.routing.action, "AUTO_ROUTE");

  const generated = evaluateWorkerPreflight({
    worker_packet: {
      ...basePacket,
      touch_points: ["generated/client.ts"],
      allowed_paths: ["generated/client.ts"],
      touch_ownership: {
        scope: "generated",
        managed: [],
        host: [],
        generated: ["generated/client.ts"],
        unknown: [],
      },
    },
    manifest_files,
    source_access: true,
  });
  assert.equal(generated.action, "GENERATOR_REQUIRED");
  assert.equal(generated.launch_target_worker, false);

  const unknown = evaluateWorkerPreflight({
    worker_packet: {
      ...basePacket,
      touch_points: ["src/unclassified.ts"],
      allowed_paths: ["src/unclassified.ts"],
      touch_ownership: {
        scope: "host",
        managed: [],
        host: [],
        generated: [],
        unknown: [],
      },
    },
    manifest_files,
    source_access: true,
  });
  assert.equal(unknown.action, "BLOCKED");
  assert.match(unknown.blockers.join(" "), /unknown ownership/);

  const forgedHost = evaluateWorkerPreflight({
    worker_packet: {
      ...basePacket,
      touch_points: [".codex/scripts/workflow-contract.mjs"],
      allowed_paths: [".codex/scripts/workflow-contract.mjs"],
      touch_ownership: {
        scope: "host",
        managed: [],
        host: [".codex/scripts/workflow-contract.mjs"],
        generated: [],
        unknown: [],
      },
    },
    manifest_files,
    source_access: true,
  });
  assert.equal(forgedHost.action, "BLOCKED");
  assert.match(forgedHost.blockers.join(" "), /conflicts with manifest ownership/);

  const wrongTopLevelRepository = evaluateWorkerPreflight({
    worker_packet: { ...basePacket, repository: "owner/automation-kit" },
    manifest_files,
    source_access: true,
  });
  assert.equal(wrongTopLevelRepository.action, "BLOCKED");
  assert.match(wrongTopLevelRepository.blockers.join(" "), /top-level repository/);
});

test("source maintenance routing deduplicates, installs the merged SHA, regresses, and resumes", () => {
  const route = routeManagedChange({
    classification: {
      valid: true,
      scope: "mixed",
      managed: [".codex/scripts/workflow-contract.mjs"],
      host: ["src/adoption.ts"],
      generated: [],
      unknown: [],
    },
    policy: "route_to_source",
    source_access: true,
    source_repository: "owner/automation-kit",
    target_repository: "owner/product-repo",
    source_issue: { repository: "owner/product-repo", number: 22 },
    summary: "Resume materialization without reopening closed Issues.",
  });
  const base = {
    routing: route,
    duplicate_search: { observed: true, issue_url: null, pr_url: null },
  };
  assert.equal(evaluateSourceMaintenanceProgress(base).next_action, "CREATE_SOURCE_ISSUE");

  const withIssue = {
    ...base,
    source_issue: {
      observed: true,
      issue_url: "https://github.com/owner/automation-kit/issues/7",
      fingerprint: route.maintenance_packet.fingerprint,
    },
  };
  assert.equal(evaluateSourceMaintenanceProgress(withIssue).next_action, "LAUNCH_SOURCE_WORKER");

  const withWorker = {
    ...withIssue,
    source_worker: { observed: true, status: "LAUNCHED" },
  };
  assert.equal(evaluateSourceMaintenanceProgress(withWorker).next_action, "WAIT_SOURCE_PR");

  const merged = "b".repeat(40);
  const withMergedPr = {
    ...withWorker,
    source_pr: {
      observed: true,
      pr_url: "https://github.com/owner/automation-kit/pull/8",
      admission: "PASS",
      merged_source_sha: merged,
    },
  };
  assert.equal(evaluateSourceMaintenanceProgress(withMergedPr).next_action, "INSTALL_EXACT_SOURCE_SHA");
  assert.equal(evaluateSourceMaintenanceProgress({
    ...withMergedPr,
    target_installation: { observed: true, source_commit: merged },
  }).next_action, "RUN_TARGET_REGRESSION");
  assert.equal(evaluateSourceMaintenanceProgress({
    ...withMergedPr,
    target_installation: { observed: true, source_commit: merged },
    target_regression: { observed: true, source_commit: merged, status: "PASS" },
  }).next_action, "RESUME_TARGET_WAVE");
  assert.deepEqual(evaluateSourceMaintenanceProgress({
    ...withMergedPr,
    target_installation: { observed: true, source_commit: merged },
    target_regression: { observed: true, source_commit: merged, status: "PASS" },
    wave_resume: { observed: true, source_commit: merged },
  }), {
    status: "COMPLETE",
    next_action: "NONE",
    blockers: [],
    merged_source_sha: merged,
  });
});

test("automation profiles collapse low-risk roles without weakening medium and high gates", () => {
  assert.deepEqual(automationProfile("team_safe"), {
    profile: "team_safe",
    automatic_github_writes: true,
    automatic_worker_launches: true,
    automatic_low_risk_merge: false,
    medium_high_exact_merge_authorization: true,
  });
  assert.equal(automationProfile("solo_fast").automatic_low_risk_merge, true);
  assert.throws(() => automationProfile("invented"), /Unknown automation profile/);

  assert.deepEqual(reviewTopologyForRisk({ profile: "solo_fast", risk: "Low" }), {
    reviewers: ["reviewer-qa"],
    deterministic_admission: true,
    exact_merge_authorization: false,
    automatic_merge: true,
  });
  assert.deepEqual(reviewTopologyForRisk({ profile: "solo_fast", risk: "Medium" }), {
    reviewers: ["reviewer", "qa", "admission-reviewer"],
    deterministic_admission: true,
    exact_merge_authorization: true,
    automatic_merge: false,
  });
  assert.deepEqual(reviewTopologyForRisk({ profile: "team_safe", risk: "Low" }), {
    reviewers: ["reviewer-qa"],
    deterministic_admission: true,
    exact_merge_authorization: true,
    automatic_merge: false,
  });
  assert.deepEqual(reviewTopologyForRisk({ profile: "regulated", risk: "High" }), {
    reviewers: ["reviewer", "qa", "admission-reviewer", "security-reviewer", "domain-reviewer"],
    deterministic_admission: true,
    exact_merge_authorization: true,
    automatic_merge: false,
  });
});

test("one durable authority lease survives retries but rejects scope, expiry, and budget drift", () => {
  const lease = {
    authority_id: "wave-authority-2026-01",
    profile: "solo_fast",
    repositories: ["owner/product-repo"],
    plan_revision: "phase-plan-r5",
    plan_item_ids: ["mvp.item"],
    issue_ids: [41, 42],
    allowed_actions: ["materialize", "create_worker", "update_lifecycle", "merge_low_risk"],
    max_worker_launches: 5,
    max_github_writes: 100,
    expires_at: "2099-01-01T00:00:00.000Z",
    approved_by: "product-owner",
  };
  const context = {
    repository: "owner/product-repo",
    plan_revision: "phase-plan-r5",
    issue_id: 41,
    action: "create_worker",
    worker_launches: 1,
    github_writes: 8,
  };
  assert.deepEqual(
    evaluateAuthorityLease(lease, context, { now: "2098-01-01T00:00:00.000Z" }),
    { valid: true, blockers: [] },
  );
  assert.equal(
    evaluateAuthorityLease(lease, { ...context, retry_task_id: "new-task" }, { now: "2098-01-01T00:00:00.000Z" }).valid,
    true,
  );
  assert.match(
    evaluateAuthorityLease(lease, { ...context, repository: "owner/other" }, { now: "2098-01-01T00:00:00.000Z" }).blockers.join(" "),
    /repository/,
  );
  assert.match(
    evaluateAuthorityLease(lease, { ...context, github_writes: 101 }, { now: "2098-01-01T00:00:00.000Z" }).blockers.join(" "),
    /write budget/,
  );
  assert.match(
    evaluateAuthorityLease(lease, context, { now: "2100-01-01T00:00:00.000Z" }).blockers.join(" "),
    /expired/,
  );
});

test("an approved complete wave launches its first Worker without returning to Planning", () => {
  const firstWorker = orchestratorControl({
    queue_length: 1,
    awaiting_human: false,
    launches: 0,
    materialization_status: "COMPLETE",
    lease_valid: true,
  });
  assert.equal(firstWorker.next_action, "LAUNCH_FIRST_WORKER");

  const retry = orchestratorControl({
    queue_length: 1,
    awaiting_human: false,
    launches: 0,
    materialization_status: "RESUMABLE",
    lease_valid: true,
  });
  assert.equal(retry.next_action, "RESUME_MATERIALIZATION");
  assert.notEqual(retry.next_action, "RETURN_TO_PLANNING");
});

test("materialization journal is stable, monotonic, and resumes without duplicate writes", () => {
  const desired_items = [
    { plan_item_id: "mvp.parent", target: { issue_state: "OPEN", project_status: "Backlog" } },
    { plan_item_id: "mvp.closed", target: { issue_state: "OPEN", project_status: "Ready" } },
    { plan_item_id: "mvp.advanced", target: { issue_state: "OPEN", project_status: "Ready" } },
    { plan_item_id: "mvp.blocked", target: { issue_state: "OPEN", project_status: "Review" } },
    { plan_item_id: "mvp.ready", target: { issue_state: "OPEN", project_status: "Ready" } },
  ];
  const desired_relations = [
    { kind: "parent", from: "mvp.parent", to: "mvp.ready" },
    { kind: "dependency", from: "mvp.advanced", to: "mvp.ready" },
  ];
  const ledger = {
    items: {
      "mvp.closed": {
        issue_number: 7,
        issue_state: "CLOSED",
        project_status: "Done",
      },
      "mvp.advanced": {
        issue_number: 8,
        issue_state: "OPEN",
        project_status: "In Progress",
      },
      "mvp.blocked": {
        issue_number: 10,
        issue_state: "OPEN",
        project_status: "Blocked",
      },
      "mvp.ready": {
        issue_number: 9,
        issue_state: "OPEN",
        project_status: "Backlog",
      },
    },
    relations: ["dependency:mvp.advanced>mvp.ready"],
    completed_operation_ids: [],
  };

  const first = buildMaterializationJournal({
    run_id: "run-r5",
    repository: "owner/product-repo",
    desired_items,
    desired_relations,
    ledger,
  });
  assert.equal(first.status, "RESUMABLE");
  assert.deepEqual(first.partition.missing, ["mvp.parent"]);
  assert.deepEqual(first.partition.existing, ["mvp.advanced", "mvp.blocked", "mvp.closed", "mvp.ready"]);
  assert.equal(first.operations.find((item) => item.key === "mvp.closed").action, "KEEP");
  assert.equal(first.operations.find((item) => item.key === "mvp.closed").reason, "PRESERVE_CLOSED");
  assert.equal(first.operations.find((item) => item.key === "mvp.closed").target.issue_state, "CLOSED");
  assert.equal(first.operations.find((item) => item.key === "mvp.closed").target.project_status, "Done");
  assert.equal(first.operations.find((item) => item.key === "mvp.advanced").action, "KEEP");
  assert.equal(first.operations.find((item) => item.key === "mvp.advanced").reason, "PRESERVE_ADVANCED_STATUS");
  assert.equal(first.operations.find((item) => item.key === "mvp.advanced").target.project_status, "In Progress");
  assert.equal(first.operations.find((item) => item.key === "mvp.blocked").action, "KEEP");
  assert.equal(first.operations.find((item) => item.key === "mvp.blocked").reason, "PRESERVE_BLOCKED");
  assert.equal(first.operations.find((item) => item.key === "mvp.blocked").target.project_status, "Blocked");
  assert.equal(first.operations.find((item) => item.key === "mvp.ready").action, "ADVANCE");
  assert.equal(first.operations.filter((item) => item.action === "CREATE").length, 2);
  assert.ok(first.operations.every((item) => /^[0-9a-f]{64}$/.test(item.operation_id)));

  const completed = first.operations
    .filter((item) => new Set(["CREATE", "ADVANCE"]).has(item.action))
    .slice(0, 2)
    .map((item) => item.operation_id);
  const resumed = buildMaterializationJournal({
    run_id: "run-r5-retry",
    repository: "owner/product-repo",
    desired_items,
    desired_relations,
    ledger: { ...ledger, completed_operation_ids: completed },
  });
  assert.deepEqual(
    resumed.operations.map((item) => item.operation_id),
    first.operations.map((item) => item.operation_id),
  );
  assert.equal(resumed.remaining_operations.length, first.remaining_operations.length - completed.length);
  assert.ok(resumed.remaining_operations.every((operationId) => /^[0-9a-f]{64}$/.test(operationId)));
});
