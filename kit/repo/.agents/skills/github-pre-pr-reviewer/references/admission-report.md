# Pre-PR Admission Report v2

Bind the report to one subject, repository, head branch/SHA, base branch/SHA, and distinct admission-reviewer identity.

```md
## Pre-PR Admission Report

Schema: 2
Subject: Issue #<number> | Bootstrap <authority> | Canonical publication <revision>
Repository/head/base: <owner/repo> / <head-branch> / <base-branch>
Head SHA: <full-sha>
Base SHA at launch/validated/current: <full-sha> / <full-sha> / <full-sha>
Admission source: <distinct task or human ID>
Status: PASS | FAIL | BLOCKED

QA tracked tree before/after: CLEAN | FAIL
Deterministic gate tracked tree before/after: CLEAN | FAIL
Acceptance and primary signal: PASS | FAIL — <evidence>
TDD: PASS | EXEMPT | FAIL — <RED/GREEN or allowed reason>
Targeted/full/integration validation: PASS | FAIL — <commands/results/SHA>
Reviewer: PASS | FAIL — <distinct ID/SHA/evidence>
QA: PASS | FAIL — <distinct ID/SHA/evidence>
Design/security/high-risk review: PASS | NOT_REQUIRED | FAIL
Branch CI: PASS | FAIL — <run URL/SHA>
Dependencies and review threads: CLEAR | BLOCKED
Baseline: PASS | FAIL — <legacy Bug links>
Documentation and rollout: PASS | NOT_REQUIRED | FAIL
Human gates: CLEAR | BLOCKED

PR action: CREATE_ONCE | USE_EXISTING | NONE
Blockers: []
```

The machine evidence follows `.codex/schemas/v2/pre-pr-admission.schema.json` and contains exactly one of:

- `worker` plus `issue`;
- `executor` plus `bootstrap`;
- `publisher` plus `canonical_publication`.

For bootstrap and Canonical publication, the authoritative default-branch `.codex/agent-workflow.json` supplies the exact target. Canonical publication additionally binds the unchanged configuration, allowed paths, SHA-256 content hashes, revision transition, approver/source, and supersession text. Mixed subject fields and unknown raw evidence keys are invalid.

`base_sha_at_launch` is immutable provenance; `validated_base_sha` records the default-branch revision against which current HEAD and all fresh evidence were validated. Bare PASS strings, copied conclusions, local absolute filesystem paths, missing identities, or stale SHA/base/config evidence are invalid.

The admission agent returns evidence but does not create the local marker. The single write owner invokes the deterministic gate with unchanged QA tree evidence. The gate preserves that evidence, adds its own before/after state, reruns commands from authoritative base configuration, reads the authoritative default branch/config from `origin`, then writes an untracked one-shot exact-target marker under the actual Git directory. The hook re-reads the authoritative base and accepts only one explicit Draft PR call for the admitted repository/head/base. If PR creation is ambiguous, query GitHub before rerunning admission; a consumed authorization cannot be reissued for the same SHA.
