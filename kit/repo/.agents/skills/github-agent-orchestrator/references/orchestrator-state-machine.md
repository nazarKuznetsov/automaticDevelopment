# Orchestrator state machine v2

## Materialization

```text
DIGEST_BOUND_PACKETS → VALIDATE_MODE → CREATE_TOP_DOWN → RELATE_NATIVE
→ ADD_TO_PROJECT → READBACK → MAP_PLAN_IDS → PUBLISH_REPORT
→ LABEL_PASSING_LEAVES (wave_execution only)
```

`materialization_only` accepts an empty Ready wave and must produce zero
`agent-ready` records. `wave_execution` requires one to five approved Ready
leaves. Never turn one mode into the other after approval.

Run `validatePlanContracts(contracts, { require_approval: true })` followed by
`evaluateOrchestratorStart(contracts, startPacket)` before any write. These are
admission decisions, not advisory diagnostics. A blocker list means zero GitHub
mutations.

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

Any head/base/admission change invalidates authorization. Merge with `expected_head_sha`; require canonical merge readback with PR, head SHA, merge commit SHA, and URL. Post-merge CI must have a run URL/workflow and be bound to that merge commit. Only this evidence permits Done/archive. Post-merge FAIL creates a blocking finding path and leaves Issue in Review.

## Handoff

At wave completion or five launches, stop launches and emit Orchestrator State/Handoff. A replacement must reconstruct from GitHub, write takeover readback, and identify its canonical task ID before the old task is archived. Never publish absolute local filesystem paths in the GitHub ledger.
