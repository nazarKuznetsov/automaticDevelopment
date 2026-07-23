# Orchestrator state machine v2

## Materialization

```text
LOCK/REMOTE/CONFIG IDENTITY → AUTHORITY_LEASE → OWNERSHIP PREFLIGHT
→ BUILD EXECUTION HORIZON → RESUME OPERATION JOURNAL
→ CREATE/ADVANCE ONLY → READBACK → PUBLISH REPORT
→ LAUNCH PASSING LEAVES (wave_execution only)
```

`materialization_only` accepts an empty Ready wave and must produce zero
`agent-ready` records. `wave_execution` requires one to five approved Ready
leaves. Never turn one mode into the other after approval.

Run `validatePlanContracts(contracts, { require_approval: true })` followed by
`evaluateOrchestratorStart(contracts, startPacket)` before any write. These are
admission decisions, not advisory diagnostics. A blocker list means zero GitHub
mutations.

Materialize only current Phase Plan hierarchy and upstream dependencies required by its at-most-five Ready leaves. Never materialize unrelated future roadmap Epics merely because they exist in the approved artifact.

Every operation has a stable digest independent of task/run identity and records `before`, `target`, `after`, and `action`. Closed Issues stay closed, an observed Project status ahead of target is kept, existing relations are kept, and completed operation IDs are excluded from retries. Technical failure produces `RESUMABLE`, not a return to Planning.

After each report readback, `orchestratorControl` selects the next action. `RESUMABLE` continues the journal; `COMPLETE` with an executable queue returns `LAUNCH_FIRST_WORKER` in the same Orchestrator session; invalid authority or `BLOCKED` state never falls back to Planning.

Use supported GitHub CLI/API operations for native hierarchy and dependencies. Probe the installed CLI help before mutation. Current documented CLI shapes are:

```text
gh issue create ... --parent <parent-number-or-url>
gh issue edit <parent> --add-sub-issue <child-number-or-url>
gh issue create ... --blocked-by <blocking-number-or-url>
gh issue edit <blocked> --add-blocked-by <blocking-number-or-url>
gh issue view <issue> --json blockedBy,blocking
```

See GitHub's [sub-issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) and [dependency](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) references. If the installed CLI/API cannot perform or read back a relationship, stop with Human Action Required. A comment is never a relationship fallback. On timeout, query by stable plan ID before retrying.

Before writes, require `gh auth status` to show a valid repository token and
Project scope, or equivalent verified API/App coverage. Browser UI automation is
not a substitute for typed read-after-write across a multi-item materialization.

Every Global Roadmap Epic and Phase Plan hierarchy item must have:

- exact Issue title;
- Phase, Work Type, Priority, Size, Risk, QA Required, and target Status;
- a stable `plan_item_id`.

All dependencies are exact `{ blocking, blocked }` plan IDs. The Phase Plan
selects one `materialization_report_parent_plan_item_id`; after mapping that item,
publish exactly one report comment on its Issue and read back the comment URL.
The report binds both packet revisions/digests and exact Project field evidence.

## Claim and launch

```text
UNCLAIMED → CLAIMED → CREATING → LAUNCHED → PR_OPEN → MERGED → DONE → ARCHIVED
                └ create failure → UNCLAIMED
                └ ambiguous → QUERY_EXISTING_TASK → CREATING | LAUNCHED
```

Before `CLAIMED`, bind config/remote/packet/Issue to one repository and classify every touch point. The manifest decides ownership for every Kit-listed path. A non-manifest product path becomes `host` only through an explicit target-surface declaration; generated paths require generator evidence. `managed` routes to the lock-recorded source, `generated` routes to its generator, and `unknown` blocks. Only an all-host target scope may become `CLAIMED`.

Source maintenance advances through stable readback-driven actions: `SEARCH_SOURCE_WORK → CREATE_SOURCE_ISSUE | LAUNCH_SOURCE_WORKER | WAIT/REVIEW/MERGE_SOURCE_PR → INSTALL_EXACT_SOURCE_SHA → RUN_TARGET_REGRESSION → RESUME_TARGET_WAVE`. Existing fingerprinted Issues/PRs skip creation. Each transition uses the same Maintenance Packet; target adoption does not start until the exact merged source SHA is installed.

`CREATING` may contain only a queued/client ID. `LAUNCHED` requires canonical top-level task ID plus managed-worktree readback. Reject forked tasks and temporary/manual worktrees.

The readback must contain matching canonical task/worktree IDs, top-level task kind, task `READY|RUNNING`, managed-worktree ownership, worktree `READY`, and observed provenance from the Codex task/worktree readback surfaces. Strings copied from a creation response are not readback.

A claim becomes stale only when the canonical task cannot be found, three scheduled heartbeats were missed, and no branch or PR exists. Branch or PR presence always requires investigation rather than automatic reassignment.

## Parallelism

Build an occupied set from active Worker `conflict_keys`. Keys are unique lowercase kebab-case values; malformed or noncanonical keys fail closed. Launch only a Ready candidate whose keys are disjoint. If a Surface Update overlaps an active Worker, stop the newer Worker before writes and serialize through dependency/integration order.

## Findings

1. Search open and recently closed Issues using the configured lookback and record evidence.
2. Duplicate: link existing Issue.
3. In scope: return to the same Worker.
4. Independent Low/Medium with complete evidence: create Bug sub-issue and native dependency; block parent if acceptance is affected.
5. High/security/data/migration/product ambiguity: Human Action Required; do not create a Ready Bug without approval.

## Merge

Accept only a Merge Authorization Packet bound to repository, PR, exact current head SHA, current base SHA, and the immutable digest/URL of the reviewed admission report. Re-read:

- PR head and current default-branch SHA;
- admission source/SHA/base;
- required checks and unresolved review threads;
- native dependencies and high-risk gates.

`solo_fast` Low risk may skip the separate Merge Authorization Packet only when deterministic admission, checks, dependencies, threads, and repository policy all pass. Medium/High and other profiles retain exact authorization. Require canonical merge readback with PR, head SHA, merge commit SHA, and URL in every profile.

## Handoff

At wave completion or five launches, stop launches and emit Orchestrator State/Handoff including authority ID, run ID, completed/remaining operation IDs, write/launch budget consumption, and source-maintenance links. A replacement reuses an unexpired unchanged lease; task replacement alone never requests product approval again.
