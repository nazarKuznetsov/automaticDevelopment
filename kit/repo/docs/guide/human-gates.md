---
title: Human Gates
description: Approval ownership, escalation shape, and the automation boundary.
order: 9
slug: human-gates
---

# Human gates

Automation should remove repeated coordination, not product accountability. Humans own:

- Canonical Brief approval;
- global roadmap approval;
- phase entry and exit;
- high-risk, security, auth, data, migration, legal, billing, destructive, dependency, and product-ambiguity decisions;
- deploy and release;
- every merge.

Low/Medium XS–M leaf Issues inside an approved phase may execute without repeated confirmation when scope, acceptance, validation, and rollback implications are clear.

## Human Action Required

Escalation must be actionable:

```yaml
schema_version: 2
packet_type: human_action_required
issue: 123
blocked_state: Validation
reason: "Migration rollback behavior is not approved."
evidence: []
decision_required: "Choose additive migration or defer schema change."
safe_options:
  - "Use the additive two-step rollout."
  - "Defer the capability to the next phase."
resume_condition: "Decision is recorded on Issue #123."
```

Do not ask a human to “check everything” or solve an uninvestigated technical problem. First exhaust safe in-scope diagnostics and present up to two concrete options.

## No silent approval

Silence, a scheduled heartbeat, a green unit test, or an agent-authored comment is not human approval. Record the human identity, approved revision/SHA, decision, timestamp, and residual risk. A phase or merge gate applies even if every automated check is green.
