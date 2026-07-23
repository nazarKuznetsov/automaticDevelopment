---
title: Existing Products
description: Migrate a repository that already used workflow v1 without losing product or GitHub history.
order: 1.5
slug: existing-products
---

# Adopt v2 in an existing product

An existing product does not restart at Discovery by default. Treat adoption as a controlled workflow migration: preserve accepted product decisions and GitHub history, reconcile them into v2 contracts, then continue from the phase supported by current evidence.

## 1. Freeze and inventory

Before changing workflow files:

1. stop new v1 Worker launches and wait for a safe boundary with no active v1 write Worker; if work cannot finish, record a verified handoff and do not start v2 writers yet;
2. record the default-branch SHA, open branches/PRs, active Issues, current Project fields/views, and unresolved human decisions;
3. identify the existing product contract, design evidence, validation commands, CI workflows, release/operations docs, and legacy failures;
4. label every observation with a URL, ID, path, or SHA. Unknown Project or repository state remains unknown until queried.

Perform the migration in its own Issue, `agent/<issue>-workflow-v2-migration` branch, and human-reviewed PR. Do not mix product behavior changes into this PR.

## 2. Reconcile installer collisions

A v1 repository has no v2 `.codex/kit-lock.json`, so start with install preview, not upgrade:

```bash
scripts/install-kit.sh --target /path/to/existing-repo --dry-run
```

Resolve every printed path by ownership:

- **Host-owned** (`AGENTS.md`, templates, workflows, hooks config, product/workflow config): manually merge the v2 requirements with repository-specific policy, then preserve each reviewed path with `--accept-host <path>`.
- **Managed** (kit skills, agents, schemas, scripts, canonical guide): move repository-specific rules into host-owned contracts, then make the target match the v2 kit. First install never allows `--force` to claim a pre-existing managed path.

When the preview is clean, apply with the exact host acknowledgments:

```bash
scripts/install-kit.sh --target /path/to/existing-repo --apply \
  --accept-host AGENTS.md \
  --accept-host .github/pull_request_template.md
```

The list above is illustrative; pass only paths actually reviewed in that repository. Inspect the Git diff and run target validation before commit. After v2 creates the lock, future releases use `--dry-run` then `--upgrade`.

## 3. Reconcile the product contract

Build `docs/product/canonical.md` from accepted existing evidence: current README/product docs, merged behavior, approved design, API/contracts, and release expectations. Preserve the old intake/setup packets as clearly labeled legacy history when they still explain decisions; do not let them remain competing active contracts.

Set the new Canonical Brief to Draft while reconciling contradictions and missing release criteria. Human approval records the exact revision/commit. Repeat Discovery only when a material audience, problem, MVP, or risk decision is genuinely unresolved—not because v2 was installed.

## 4. Migrate the GitHub Project in place

Preserve the existing Project and its history unless a human explicitly chooses a new Project. Apply this non-destructive mapping:

- `Intake → Backlog`;
- keep compatible Ready, In Progress, Review, Blocked, and Done values;
- add Validation and Canceled;
- add Phase, Priority, Size, Risk, QA Required, and Iteration where missing;
- retain old Work Type options until existing items are mapped, then use the v2 portable values;
- enable Parent issue/Sub-issue progress, Issue Types, or merge queue only after target capability verification.

Read fields/items back after every mutation. Add native hierarchy and dependencies for remaining/open work; do not manufacture historical Issues solely to retrofit completed work into a perfect tree.

Add stable `plan_item_id`, merge outcome, primary signal, owner layer, conflict keys, expected touch points, integration order/validation, reviewers, human gates, and out-of-scope only to active/future work that may execute. Do not rewrite closed history solely to populate the new form.

## 5. Establish phase and baseline

Determine the current phase from evidence rather than repository age. Foundation may already be complete while MVP remains active; an operational product may enter Stabilization, Production, or Growth. Record phase-entry approval before opening a v2 wave.

Bind the baseline to the exact default-branch SHA and run configured validation there. Each accepted legacy failure needs a separate Bug Issue plus evidence from that base SHA. A new or touched failure is never legacy.

Before the next UI wave, run a Design Readiness audit over the approved MVP. Reuse accepted screens and flows; fill evidence/state/accessibility gaps instead of redesigning completed UI without a product decision.

## 6. Continue, do not bootstrap

Use continuation planning after the migration PR merges.

### Existing product continuation — EN

```text
Use $github-project-planner in continuation mode in a fresh read-only task for <owner/repo>. This repository already used workflow v1 and has now migrated to workflow schema v2. Read the approved canonical contract, current code, verified Project fields/items, open and recently closed Issues, merged/open PRs, baseline evidence, phase reports, and latest accepted handoff. Do not repeat Discovery, recreate completed work, create a new Project, copy the old Planner chat, or mutate GitHub. Preserve/assign stable plan_item_id values and return an observed/inferred/planned/unknown migration audit, current phase approval, refreshed roadmap, and at most five complete unblocked XS–M merge units with native hierarchy/dependencies, owner layers, conflict keys, integration validation, reviewers, and gates.
```

### Продолжение существующего продукта — RU

```text
Используй $github-project-planner в continuation mode в новой read-only task для <owner/repo>. Этот репозиторий уже работал по workflow v1 и теперь мигрирован на workflow schema v2. Прочитай утверждённый canonical contract, текущий код, проверенные поля/items Project, открытые и недавно закрытые Issues, merged/open PRs, baseline evidence, phase reports и последний принятый handoff. Не повторяй Discovery, не пересоздавай завершённую работу, не создавай новый Project, не копируй старый Planner chat и не изменяй GitHub. Сохрани/назначь стабильные plan_item_id и верни migration audit со статусами observed/inferred/planned/unknown, утверждение текущей фазы, roadmap и максимум пять полных незаблокированных XS–M merge units с native hierarchy/dependencies, owner layers, conflict keys, integration validation, reviewers и gates.
```

## 7. Prove the migration

After the migration PR is merged, authorize one Low-risk dogfood wave. Verify source/target and ownership preflight, canonical top-level Worker task/managed-worktree readback in the same orchestration session, zero PRs on failing branch CI, profile-appropriate independent review, deterministic admission, merge authorization required by the selected profile/risk, Orchestrator merge readback, and post-merge CI bound to the merge commit before Done/archive. Retry from the same operation journal and prove that no GitHub object is duplicated. Do not use deploy, migration, auth, or customer data for the pilot.

Rollback is Git-first: revert the migration PR if repository behavior is unsafe. Project field additions should remain non-destructive during evaluation; do not delete old fields/data until v2 has completed an accepted wave and a human approves cleanup.

## Repair an unmaterialized v2 plan after the 2.0.1 contract hotfix

Kit 2.0.1 closes the fail-open gap between roadmap prose and executable materialization. If Stage A stopped before GitHub writes, do not clean up or retrofit partial product state: there is none to reconcile. Upgrade only the kit-managed workflow files in a workflow-only branch/PR, preserving host-owned product semantics and configuration. After that PR is human-merged:

1. run the installed contract tests and validator;
2. keep the rejected packet as immutable historical evidence;
3. start a fresh read-only Planner in Repair mode;
4. preserve accepted outcomes and stable IDs, but emit complete new Global Roadmap and Phase Plan revisions/digests;
5. require exact titles/Project metadata, typed dependencies, a valid report parent, and a zero-blocker validator result;
6. request human approval of both exact revisions/digests;
7. do not materialize, create product Issues, or launch Workers until that new approval is recorded.

This is a contract repair, not a new product-planning cycle. The Planner must not reinterpret the Canonical Brief or add product scope merely because the machine schema became stricter.

## Retire managed admission overrides with 2.0.2

Kit 2.0.2 moves generic one-time bootstrap, Canonical publication, and exact PR-target admission into managed core. Keep only verified repository values in host-owned `.codex/agent-workflow.json` and `docs/project-workflow-runbook.md`.

For a repository with older local copies of the managed hook, schema, gate, contract, or guide pages:

1. run installer `--dry-run` from the 2.0.2 source;
2. verify every collision is a previously recorded managed path and that core covers the required generic behavior;
3. run `--upgrade --force` only to replace those recorded managed overrides, plus `--accept-host` for reviewed host config/runbook values;
4. verify the resulting managed files exactly match the 2.0.2 source and no product/canonical/Issue/Project/Worker state changed;
5. validate and merge the workflow-only PR through the normal human gate;
6. recompute any not-yet-materialized Planner Packet against the installed validators and obtain exact approval before materialization.

Do not copy repository-specific check names, branches, revisions, IDs, hashes, or URLs back into managed documentation.

## Upgrade 2.0.x installations to 2.1

1. Run the 2.1 installer from a clean exact source commit and verify separate source/target output.
2. Preserve reviewed host-owned files with path-scoped `--accept-host`; retire only recorded managed overrides with reviewed `--force`.
3. Verify lock v3 source repository/commit/tree and target repository/origin/default branch.
4. Set an explicit automation profile and managed-change policy in host configuration. Adopt merge mode `profile_risk_then_orchestrator` and enable the profile-controlled Low-risk capability; `team_safe` still requires human merge, while only `solo_fast` Low may use it automatically.
5. Replace full-roadmap materialization with the current execution horizon and one Wave Authority Lease.
6. Preserve existing Issue state. Closed and advanced Project items must produce `KEEP`, never reopen/downgrade.
7. Run one Low-risk pilot proving ownership preflight, resumable journal, profile-appropriate review, and post-merge reconciliation.

The upgrade changes workflow mechanics, not approved product meaning. Do not repeat Discovery or roadmap approval unless the product contract or planned scope actually changed.
