---
title: Design Gate
description: Complete UX/UI readiness before opening the MVP UI queue.
order: 4
slug: design-gate
---

# Design readiness gate

Design is a product contract, not a final polish pass. Before MVP UI Issues become Ready, cover the whole approved MVP:

- end-to-end flows and navigation;
- screens, components, and content hierarchy;
- loading, empty, error, success, disabled, optimistic, stale, and permission states;
- responsive behavior and input modes;
- accessibility semantics, keyboard/focus, contrast, motion, and zoom;
- production copy, localization constraints, assets, and ownership;
- acceptance evidence that a reviewer can inspect.

Record these in Design Readiness Packet v2 with `PASS`, `FAIL`, or `BLOCKED` and a human approval.

## Figma is optional

When Figma is connected, link stable file/node URLs and record the approved revision. The kit never requires a Figma plugin. Accept screenshots, prototypes, diagrams, written flows, asset links, and content tables when they provide equivalent inspectable evidence.

## Foundation overlap

Non-UI Foundation may proceed while design is unfinished: repository setup, CI, test harness, observability skeleton, and neutral architecture boundaries. Design tokens may be prepared when values are approved. Do not build screens, component APIs, or navigation that encode unresolved design choices.

## Change after gate

A material flow or acceptance change returns affected UI work to Backlog and reopens design review. Small implementation discoveries may become Low/Medium Finding Packets; product ambiguity is always a human gate.
