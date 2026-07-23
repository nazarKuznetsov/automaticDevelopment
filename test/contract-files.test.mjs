import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const kit = join(root, "kit", "repo");

function json(path) {
  return JSON.parse(readFileSync(join(kit, path), "utf8"));
}

test("workflow config pins wave-scoped fresh-task and exact-SHA merge defaults", () => {
  const workflow = json(".codex/agent-workflow.json");
  assert.equal(workflow.kit_version, "2.1.0");
  assert.deepEqual({
    orchestrator_scope: workflow.execution.orchestrator_scope,
    task_strategy: workflow.execution.task_strategy,
    worker_environment: workflow.execution.worker_environment,
    forbid_worker_fork: workflow.execution.forbid_worker_fork,
    single_write_owner: workflow.execution.single_write_owner,
    parallelism_policy: workflow.execution.parallelism_policy,
    subagent_max_depth: workflow.execution.subagent_max_depth,
    max_active_subagents_per_worker: workflow.execution.max_active_subagents_per_worker,
    claim_stale_after_missed_heartbeats: workflow.execution.claim_stale_after_missed_heartbeats,
    archive_worker_after: workflow.execution.archive_worker_after,
    automation_profile: workflow.execution.automation_profile,
    managed_change_policy: workflow.execution.managed_change_policy,
  }, {
    orchestrator_scope: "wave",
    task_strategy: "fresh_top_level_per_leaf",
    worker_environment: "managed_worktree",
    forbid_worker_fork: true,
    single_write_owner: true,
    parallelism_policy: "disjoint_conflict_keys",
    subagent_max_depth: 1,
    max_active_subagents_per_worker: 2,
    claim_stale_after_missed_heartbeats: 3,
    archive_worker_after: "post_merge_done",
    automation_profile: "team_safe",
    managed_change_policy: "route_to_source",
  });
  assert.deepEqual(workflow.merge, {
    mode: "profile_risk_then_orchestrator",
    approval_binding: "pr_and_head_sha",
    require_fresh_base: true,
    automatic_low_risk_merge: true,
  });
  assert.deepEqual(workflow.worktree, { setup_commands: [], required_paths: [], copy_ignored_files: false });
  assert.deepEqual(workflow.validation.integration, []);
  assert.equal(workflow.bootstrap, null);
  assert.equal(workflow.canonical_publication, null);
});

test("repository values are host-owned and managed documentation stays product-neutral", () => {
  const manifest = JSON.parse(readFileSync(join(root, "kit", "manifest.json"), "utf8"));
  const ownership = Object.fromEntries(manifest.files.map((entry) => [entry.path, entry.ownership]));
  assert.equal(ownership[".codex/agent-workflow.json"], "host");
  assert.equal(ownership["docs/project-workflow-runbook.md"], "host");
  for (const path of [
    ".codex/hooks/pre_pr_admission.py",
    ".codex/schemas/v2/pre-pr-admission.schema.json",
    ".codex/scripts/pre-pr-gate.mjs",
    ".codex/scripts/workflow-contract.mjs",
    "docs/guide/operations.md",
    "docs/guide/pre-pr-gate.md",
  ]) assert.equal(ownership[path], "managed", path);

  for (const path of [
    "docs/guide/contracts.md",
    "docs/guide/existing-products.md",
    "docs/guide/operations.md",
    "docs/guide/pre-pr-gate.md",
    "docs/guide/troubleshooting.md",
  ]) {
    const content = readFileSync(join(kit, path), "utf8");
    assert.doesNotMatch(content, /BotBasketFlow|PR Validation \/ quality|PR Validation \/ visual/, path);
  }
});

test("packet schemas cover task lifecycle without durable local paths", () => {
  const schemaDir = join(kit, ".codex", "schemas", "v2");
  const files = readdirSync(schemaDir).sort();
  for (const required of [
    "merge-authorization.schema.json",
    "kit-maintenance.schema.json",
    "orchestrator-start.schema.json",
    "orchestrator-state-handoff.schema.json",
    "plan-materialization-report.schema.json",
    "surface-update.schema.json",
    "wave-authority-lease.schema.json",
    "wave-completion.schema.json",
  ]) assert.ok(files.includes(required), `missing ${required}`);

  const worker = json(".codex/schemas/v2/worker.schema.json");
  for (const field of [
    "plan_item_id",
    "base_sha_at_launch",
    "owner_layer",
    "conflict_keys",
    "touch_points",
    "integration_order",
    "repository_identity",
    "touch_ownership",
    "allowed_paths",
    "kit_source_binding",
    "managed_change_policy",
    "authority_lease",
  ]) {
    assert.ok(worker.required.includes(field), `Worker Packet missing ${field}`);
  }
  const finding = json(".codex/schemas/v2/finding.schema.json");
  for (const field of ["source_task_id", "failure_signature", "affected_acceptance_ids", "duplicate_search_evidence", "security", "data_risk", "migration_risk", "product_ambiguity"]) {
    assert.ok(finding.required.includes(field), `Finding Packet missing ${field}`);
  }
  const admission = json(".codex/schemas/v2/pre-pr-admission.schema.json");
  for (const field of ["base_sha_at_launch", "validated_base_sha", "qa_tracked_worktree"]) {
    assert.ok(admission.required.includes(field), `Pre-PR Admission missing ${field}`);
  }
  assert.equal(admission.required.includes("worker"), false);
  assert.equal(admission.required.includes("issue"), false);
  assert.equal(admission.oneOf.length, 3);
  for (const field of ["worker", "issue", "executor", "bootstrap", "publisher", "canonical_publication"]) {
    assert.ok(admission.properties[field], `Pre-PR Admission missing subject field ${field}`);
  }
  const start = json(".codex/schemas/v2/orchestrator-start.schema.json");
  for (const field of [
    "mode",
    "global_roadmap_revision",
    "global_roadmap_digest",
    "phase_plan_revision",
    "phase_plan_digest",
    "approved_plan_items",
    "authority_lease",
  ]) assert.ok(start.required.includes(field), `Orchestrator Start missing ${field}`);
  assert.equal(start.properties.approved_issues, undefined);
  assert.equal(start.$defs.plan_item.properties.number, undefined);
  assert.ok(start.properties.authorization.required.includes("approved_by"));
  assert.equal(start.properties.authority_lease.$ref, "wave-authority-lease.schema.json");
  assert.match(start.$defs.conflict_keys.items.pattern, /a-z0-9/);
  assert.ok(start.allOf.some((rule) => rule.if?.properties?.mode?.const === "materialization_only"));
  assert.ok(start.allOf.some((rule) => rule.if?.properties?.mode?.const === "wave_execution"));
  const merge = json(".codex/schemas/v2/merge-authorization.schema.json");
  for (const field of ["repository", "pr", "head_sha", "base_sha", "admission_report_url", "admission_report_digest"]) {
    assert.ok(merge.required.includes(field), `Merge Authorization missing ${field}`);
  }
  const maintenance = json(".codex/schemas/v2/kit-maintenance.schema.json");
  for (const field of ["fingerprint", "repository", "target_repository", "source_issue", "managed_paths", "target_adoption"]) {
    assert.ok(maintenance.required.includes(field), `Kit Maintenance Packet missing ${field}`);
  }
  const lease = json(".codex/schemas/v2/wave-authority-lease.schema.json");
  const leaseActions = lease.properties.allowed_actions.items.enum;
  for (const action of ["create_issue", "update_issue", "create_comment", "create_relation", "update_project", "create_worker", "manage_claim", "heartbeat", "retry_operation"]) {
    assert.ok(leaseActions.includes(action), `Wave Authority Lease missing routine action ${action}`);
  }
  const allSchemas = files.map((file) => readFileSync(join(schemaDir, file), "utf8")).join("\n");
  assert.doesNotMatch(allSchemas, /worktree_path|filesystem_path/);
});

test("planning schemas are complete enough for fail-closed materialization", () => {
  const roadmap = json(".codex/schemas/v2/global-roadmap.schema.json");
  for (const field of ["revision", "packet_digest"]) {
    assert.ok(roadmap.required.includes(field), `Global Roadmap missing ${field}`);
  }
  const epic = roadmap.properties.phases.items.properties.epics.items;
  for (const field of ["plan_item_id", "title", "work_type", "priority", "size", "risk", "qa_required", "status"]) {
    assert.ok(epic.required.includes(field), `Roadmap Epic missing ${field}`);
  }
  const roadmapDependency = roadmap.$defs.dependency;
  assert.deepEqual(roadmapDependency.required, ["blocked", "blocking"]);

  const phasePlan = json(".codex/schemas/v2/phase-plan.schema.json");
  for (const field of ["packet_digest", "materialization_report_parent_plan_item_id"]) {
    assert.ok(phasePlan.required.includes(field), `Phase Plan missing ${field}`);
  }
  const hierarchyItem = phasePlan.properties.hierarchy.items;
  for (const field of ["plan_item_id", "parent_plan_item_id", "title", "phase", "work_type", "priority", "size", "risk", "qa_required", "status"]) {
    assert.ok(hierarchyItem.required.includes(field), `Phase hierarchy missing ${field}`);
  }

  const report = json(".codex/schemas/v2/plan-materialization-report.schema.json");
  for (const field of [
    "materialization_mode",
    "global_roadmap_revision",
    "global_roadmap_digest",
    "phase_plan_revision",
    "phase_plan_digest",
    "report_parent_plan_item_id",
    "report_parent_issue_url",
    "report_url",
    "run_id",
    "repository",
    "operation_journal",
    "completed_operation_ids",
    "remaining_operations",
    "resume_state",
  ]) assert.ok(report.required.includes(field), `Materialization Report missing ${field}`);
  const passRule = report.allOf.find((rule) => rule.if?.properties?.status?.const === "PASS");
  assert.equal(passRule.then.properties.agent_ready_readback?.minItems, undefined);
  const materializationOnlyRule = report.allOf.find((rule) => rule.if?.properties?.materialization_mode?.const === "materialization_only");
  assert.equal(materializationOnlyRule.then.properties.agent_ready_readback.maxItems, 0);
});

test("custom agents include distinct admission and non-authoring medium QA/design defaults", () => {
  const agentsDir = join(kit, ".codex", "agents");
  const admission = readFileSync(join(agentsDir, "admission-reviewer.toml"), "utf8");
  const qa = readFileSync(join(agentsDir, "qa.toml"), "utf8");
  const design = readFileSync(join(agentsDir, "design-reviewer.toml"), "utf8");
  assert.match(admission, /name = "admission-reviewer"/);
  assert.match(admission, /model_reasoning_effort = "high"/);
  assert.match(qa, /model_reasoning_effort = "medium"/);
  assert.match(qa, /tracked diff is FAIL/);
  assert.match(design, /model_reasoning_effort = "medium"/);
  for (const file of readdirSync(agentsDir)) {
    assert.doesNotMatch(readFileSync(join(agentsDir, file), "utf8"), /model\s*=\s*"gpt-/);
  }
});
