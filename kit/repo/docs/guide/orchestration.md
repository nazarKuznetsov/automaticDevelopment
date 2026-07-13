---
title: Orchestration
description: Worker isolation, bounded concurrency, Finding triage, heartbeat, and handoff.
order: 6
slug: orchestration
---

# Orchestration

Orchestrator executes the approved Ready wave. It does not brainstorm, change the roadmap, or fill an idle queue from memory.

This workflow uses Codex [subagents/custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents) for bounded delegation and Codex [managed worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees) for task isolation. Their presence in documentation does not prove the current client exposes the needed task controls; probe first.

## Heartbeat loop

Every active heartbeat re-reads Project Ready items, In Progress/Validation Issues, native dependencies, claims, linked PRs, checks, requested changes, Finding Packets, and human blockers. It reconciles stale status before launching anything.

Every external write is followed by read-after-write verification. Record returned task/worktree IDs, GitHub URLs/IDs, branch names, and SHAs; on an ambiguous timeout, query before retrying. A planned call, generated prompt, or tool description is not a completed mutation.

Keep at most two write Workers and five total launches per Orchestrator. Attach a scheduled heartbeat every 20 minutes while executable work exists. Pause when the queue is empty or only a human can unblock it.

A Worker launch counts only after task/worktree creation and claim verification; relaunching the same Issue counts again. Review agents and the replacement Orchestrator do not count. Track repeated failures by stable check/test ID plus normalized failure signature and record Attempt 1/2/3; a successful run resets that signal.

## Worker launch prompt — EN

```text
Use $github-agent-worker for Worker Packet v2 below. Work on exactly one Ready leaf Issue in its managed worktree and agent/<issue>-<slug> branch. Use TDD, return out-of-scope defects as Finding Packets, obtain independent review/QA and conditional specialists, and do not create a PR before a SHA-bound Admission PASS.
<worker-packet>
```

## Промпт запуска Worker — RU

```text
Используй $github-agent-worker для Worker Packet v2 ниже. Работай ровно над одной Ready leaf Issue в её managed worktree и ветке agent/<issue>-<slug>. Используй TDD, возвращай дефекты вне scope как Finding Packets, получи независимые review/QA и условных specialists, не создавай PR до SHA-bound Admission PASS.
<worker-packet>
```

Create a separate top-level Codex task and managed worktree per Issue only after the relevant tools are discovered and probed. Managed worktrees may begin at detached HEAD, so create and verify the Issue branch inside that worktree. Inside Workers, allow only bounded read-heavy subagents. If task/worktree creation is unavailable, run one write Worker with read-only sibling reviewers; final fallback is a complete copy-paste prompt. Never describe a prompt as a created task.

Independent reviewer/QA evidence must come from separate task/thread/agent IDs or named humans and must bind to the exact SHA. The Worker cannot imitate a missing reviewer. Optional capability or tool absence is recorded as unavailable and follows the fallback; it is never guessed from documentation or memory.

## Finding loop

Worker never creates an Issue. Orchestrator searches open Issues plus the configured 90-day closed-Issue window, records the query, links duplicates, returns in-scope Low/Medium fixes, requests missing/invalid severity evidence, or creates a proven independent Low/Medium Bug as sub-issue and dependency. It reads the new Issue and relationships back before reporting success or retrying. It blocks the parent when acceptance is broken. High/security/data/migration/product ambiguity always becomes Human Action Required before any Ready Bug, even when the possible fix appears in scope.

## Handoff

After launch five, mark the ledger DRAINING and create a fresh Orchestrator task. The replacement task ID must be returned, then the replacement audits GitHub and records `handoff accepted`; only then may the old task retire. If tooling cannot create the replacement, output a handoff packet and pause new launches.
