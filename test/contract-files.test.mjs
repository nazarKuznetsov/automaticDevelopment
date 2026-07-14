import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const kit = resolve(import.meta.dirname, "..", "kit", "repo");

function json(path) {
  return JSON.parse(readFileSync(join(kit, path), "utf8"));
}

test("workflow config pins wave-scoped fresh-task and exact-SHA merge defaults", () => {
  const workflow = json(".codex/agent-workflow.json");
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
  });
  assert.deepEqual(workflow.merge, {
    mode: "human_approval_then_orchestrator",
    approval_binding: "pr_and_head_sha",
    require_fresh_base: true,
    automatic_low_risk_merge: false,
  });
  assert.deepEqual(workflow.worktree, { setup_commands: [], required_paths: [], copy_ignored_files: false });
  assert.deepEqual(workflow.validation.integration, []);
});

test("packet schemas cover task lifecycle without durable local paths", () => {
  const schemaDir = join(kit, ".codex", "schemas", "v2");
  const files = readdirSync(schemaDir).sort();
  for (const required of [
    "merge-authorization.schema.json",
    "orchestrator-start.schema.json",
    "orchestrator-state-handoff.schema.json",
    "plan-materialization-report.schema.json",
    "surface-update.schema.json",
    "wave-completion.schema.json",
  ]) assert.ok(files.includes(required), `missing ${required}`);

  const worker = json(".codex/schemas/v2/worker.schema.json");
  for (const field of ["plan_item_id", "base_sha_at_launch", "owner_layer", "conflict_keys", "touch_points", "integration_order"]) {
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
  const start = json(".codex/schemas/v2/orchestrator-start.schema.json");
  assert.ok(start.required.includes("approved_plan_items"));
  assert.equal(start.properties.approved_issues, undefined);
  assert.equal(start.properties.approved_plan_items.items.properties.number, undefined);
  assert.match(start.$defs.conflict_keys.items.pattern, /a-z0-9/);
  const merge = json(".codex/schemas/v2/merge-authorization.schema.json");
  for (const field of ["repository", "pr", "head_sha", "base_sha", "admission_report_url", "admission_report_digest"]) {
    assert.ok(merge.required.includes(field), `Merge Authorization missing ${field}`);
  }
  const allSchemas = files.map((file) => readFileSync(join(schemaDir, file), "utf8")).join("\n");
  assert.doesNotMatch(allSchemas, /worktree_path|filesystem_path/);
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
