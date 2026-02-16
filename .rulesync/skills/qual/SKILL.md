---
name: qual
description: Orchestrate multi-lens quality analysis using agent teams. Spawns specialist teammates that analyze code from different angles, then consolidates findings for user approval before implementing fixes.
disable-model-invocation: true
argument-hint: [path]
---

target_path = $ARGUMENTS

Scope: If target_path provided, focus on that path. Otherwise, analyze recent changes and critical paths.

## Workflow

**Two-wave pipeline: wave 1 (detect + fix) → wave 2 (simplify the result)**

You coordinate specialists, consolidate findings with expert judgment, and never modify code without user approval.

## Wave 1: Detect Issues

### Phase 1a: Parallel Analysis

Create a team via `TeamCreate`, then spawn specialist teammates (via `Task` tool with `team_name` parameter). Each teammate applies one lens from [lenses.md](lenses.md):

| Teammate | Focus |
|----------|-------|
| Skeptic | Bugs, security, performance, correctness |
| Silent-failure hunter | Hidden errors, swallowed exceptions |
| Pattern harmonizer | Divergent implementations, inconsistent patterns |
| Comment auditor | Misleading/stale/useless comments |

All teammates: **analysis-only**. Report findings via `SendMessage` with severity + file:line + fix.

**Simplifier is NOT in wave 1.** It runs in wave 2 after fixes are applied.

### Phase 1b: Expert Triage

Consolidate wave 1 findings. Categorize by severity:

- **CRITICAL**: Security vulnerabilities, data loss risks, silent failures hiding bugs
- **HIGH**: Logic errors, missing error handling on critical paths
- **MEDIUM**: Pattern inconsistencies, genuine maintainability issues
- **LOW**: Minor improvements
- **IGNORE**: False positives, justified patterns, style-only concerns

**Conflict resolution:**

- Safety > style
- Cohesion > fragmentation (don't split files just for line counts)
- Direct code > abstraction
- Pattern consistency > local optimization
- Type annotations > JSDoc (don't flag missing JSDoc on typed code)

### Phase 1c: Present and Stop

Present consolidated wave 1 report grouped by priority. Include:
- Summary counts per priority level
- Each finding: location, issue, recommended fix

**STOP here.** Wait for user to select which fixes to apply. Never proceed without explicit approval.

### Phase 1d: Implement Wave 1 Fixes

After user approval, execute approved fixes.

## Wave 2: Simplify

**Purpose:** Wave 1 fixes may introduce new complexity. The Simplifier runs on the post-fix codebase to catch over-engineering — both pre-existing and newly introduced.

### Phase 2a: Simplifier Analysis

Spawn one Simplifier teammate (via `Task` tool with `team_name` parameter) applying its lens from [lenses.md](lenses.md) on the same target path. It analyzes the **current state** of code after wave 1 fixes.

### Phase 2b: Triage + Present

Consolidate Simplifier findings using same severity levels. Present report.

**STOP here.** Wait for user approval.

### Phase 2c: Implement Simplifier Fixes

After user approval, execute approved simplification fixes.

## Team Lifecycle

After all waves are complete, send `shutdown_request` to each active teammate and clean up via `TeamDelete`.

## Verify

Run /lint to verify all quality gates pass after both waves.
