---
name: plan
description: Create an executable implementation plan that another agent can follow without questions. Use when planning complex features, refactors, or multi-step changes.
disable-model-invocation: true
argument-hint: [task description]
---

task = $ARGUMENTS

Create an executable implementation plan that another agent can follow without asking questions.

## Core Concept

A good plan is **self-contained and unambiguous**. The executing agent has NO access to this conversation — they can only read the plan and explore the codebase.

**Plan complexity should match task complexity.** A 3-step fix needs 3 lines, not 11 sections.

## Scope Assessment

Before starting, assess the task scope:

**Small task** (1-3 files, single concern): Plan directly as a single agent. Skip team exploration.

**Large task** (4+ files, multiple concerns, unfamiliar domain): Create a team via `TeamCreate` and spawn parallel exploration teammates:

| Teammate | Focus |
|----------|-------|
| Codebase explorer | Existing patterns, relevant files, dependencies in `src/` |
| Domain researcher | Web search for libraries, APIs, best practices |

Explorers are **read-only** — they use only search and read tools, never edit. Each reports findings back via `SendMessage`. You synthesize into the plan.

**Decision rule:** If you'd need to sequentially explore 5+ files across different concerns, use team exploration. Otherwise, just do it yourself.

## Planning Process

1. **Explore** — Direct exploration or team-based parallel exploration (based on scope assessment above)
2. **Synthesize** — Combine findings into coherent understanding
3. **Decompose** — Break into milestones → steps → atomic actions
4. **Order** — Build dependency graph, identify parallel opportunities
5. **Verify** — Could a new agent execute this without asking questions?

## What Makes a Plan Executable

1. **Context transfer** — Background, problem statement, domain concepts
2. **Exploration pointers** — Files to read before coding (agent will explore)
3. **Unambiguous steps** — No hidden assumptions, no "as appropriate"
4. **Verification criteria** — How to know each step succeeded

## Required Sections (for delegation)

**Background & Problem** — Why this change? What's broken? Include error messages if relevant.

**Key Concepts** — Domain terms, sentinel values, special patterns. Table format.

**Exploration Checklist** — Files to read before coding:
```
- [ ] Schema: `src/db/schema.ts` — understand data structure
- [ ] Service: `src/core/service.ts` — existing patterns
```

## Optional Sections (include only if relevant)

**Questions** — Surface blockers first. Provide concrete options with tradeoffs, not open-ended asks.

**Approach** — 2-3 sentences: strategy, key decision, why this over alternatives.

**Changes** — Grouped by component:
```
### Component Name
- `[NEW]` `path/file.ts` — purpose
- `[MOD]` `path/file.ts` — what changes
- `[DEL]` `path/file.ts` — why removing
```

**Steps** — Atomic tasks with file references:
```
1. **Milestone** — goal
   - 1.1 Action → `file.ts:ClassName.method()` — verification
```

**Work Decomposition** — For /orch:
```
Parallel: Unit A (files), Unit B (files)
Sequential: Unit C depends on A
```
Or: "Single unit — no parallelization needed."

**Risks** — Only non-obvious risks with mitigations.

**Done When** — Acceptance criteria checklist.

## Style

- Bullets and lists, not prose paragraphs
- File paths + function names, NOT line numbers (they drift)
- No methodology explanations
- No hedging — decide or ask
- No obvious statements ("We will write tests")

## Plan File Location

Save to `docs/plans/<type>-<short-name>.md`

Types: `feat-`, `fix-`, `refactor-`, `chore-`
