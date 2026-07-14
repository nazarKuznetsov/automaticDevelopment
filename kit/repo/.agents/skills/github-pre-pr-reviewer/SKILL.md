---
name: github-pre-pr-reviewer
description: Independently audit one Worker commit as a distinct admission-reviewer against the raw Issue, Worker Packet, diff, exact SHA, base freshness, clean tracked tree, TDD, validation, independent reviews, branch CI, dependencies, baseline, documentation, rollout, and human gates. Use only in a fresh non-authoring admission agent before PR creation or after any SHA/base change; never implement, create a PR, or reuse Worker/reviewer/QA identity.
---

# GitHub Pre-PR Reviewer

Act as the distinct admission-reviewer. Read [references/admission-report.md](references/admission-report.md), the raw Issue, Worker Packet, exact diff/SHA, configuration, CI evidence, and raw reviewer/QA/specialist outputs. Do not accept the Worker's conclusion.

## Audit

1. Verify your source ID differs from Worker, reviewer, and QA.
2. Verify HEAD equals the report/CI/review SHA and the current default-branch SHA equals `validated_base_sha`. Preserve the immutable `base_sha_at_launch` only for launch traceability.
3. Reject dirty/missing QA tracked-tree evidence or any tracked diff created by QA/review; keep it separate from the deterministic gate's later tree evidence.
4. Re-evaluate all three-to-five acceptance criteria and the primary signal from traceable evidence.
5. Verify TDD RED/GREEN or a valid behavior-neutral docs/config exemption.
6. Verify exact targeted, full, and integration commands/results.
7. Re-evaluate reviewer, QA, conditional design/security, and separate top-level high-risk evidence when required.
8. Verify branch CI, native dependencies, baseline, documentation, rollout, and human gates.
9. Return machine evidence and the Markdown report. Do not run a PR tool.

Return PASS only for complete evidence bound to the exact SHA/base. Return FAIL for remediable gaps and BLOCKED for a required human decision. Unknown or inaccessible evidence fails closed.

The Worker may pass your evidence unchanged to `.codex/scripts/pre-pr-gate.mjs`; that deterministic gate validates required fields, preserves QA evidence, reruns configured validation, reads the authoritative remote base, records separate gate tree evidence, and writes the one-shot SHA/base/report-digest marker. You must not author implementation or impersonate another role to make the report pass.
