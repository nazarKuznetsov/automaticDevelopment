# Pre-PR Admission Report v2

Bind the report to one head SHA, one base SHA, and one distinct admission-reviewer identity.

```md
## Pre-PR Admission Report

Schema: 2
Issue: #<number>
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

The machine evidence follows `.codex/schemas/v2/pre-pr-admission.schema.json`. `base_sha_at_launch` is immutable provenance; `validated_base_sha` records the default-branch revision against which the current HEAD and all fresh evidence were validated. Bare PASS strings, copied conclusions, local absolute filesystem paths, missing identities, or stale SHA/base evidence are invalid.

The admission agent returns evidence but does not create the local marker. The single write-owner Worker invokes the deterministic gate with the unchanged QA tree evidence. The gate preserves that evidence, adds its own before/after state, reruns configured commands, reads the authoritative default branch from `origin`, then writes an untracked one-shot marker under the actual Git directory. The marker contains an admission report digest; the hook re-reads the authoritative base and rejects a stale marker. If PR creation is ambiguous, query GitHub before rerunning admission.
