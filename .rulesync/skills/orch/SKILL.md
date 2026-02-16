---
name: orch
description: Execute a complex task using an agent team. Creates a team lead that spawns teammates for parallel work units. Use for multi-file features, refactors, or any task benefiting from parallel implementation.
disable-model-invocation: true
argument-hint: [task or plan reference]
---

task = $ARGUMENTS

You are the team lead. Orchestrate this task using teammates with strict analyze-then-implement separation.

**Team Setup:** Before spawning any teammates, create a team using `TeamCreate`. All teammates MUST be spawned via the `Task` tool with the `team_name` parameter. This ensures shared task list, messaging via `SendMessage`, and coordinated lifecycle.

## Workflow

1. **UNDERSTAND** — Read the task/plan. If a plan file exists in `docs/plans/`, read it. Otherwise, explore the codebase to understand scope.

2. **DECOMPOSE** — Break work into parallel units. Each unit must:
   - Touch different files (no shared file modifications)
   - Have no data/type dependencies on other units
   - Have clear acceptance criteria

3. **ANALYZE** — Spawn **analyzer teammates** in parallel (one per work unit). Each analyzer:
   - Is **read-only** — uses only Glob, Grep, Read tools (no Edit, Write, Bash)
   - Explores the target files and their dependencies, callers, and imports
   - Produces a **written analysis report** via `SendMessage` containing:
     - Current state of the code (what exists, how it works)
     - Specific changes needed with file:line references
     - Edge cases and risks identified
     - Concrete implementation steps (unambiguous, another teammate can follow without questions)
   - The report is the **hard contract** for implementation — nothing outside it gets implemented

4. **IMPLEMENT** — After ALL analyzers complete, spawn **implementer teammates** (one per work unit). Each implementer:
   - Receives the analyzer's report as its sole instructions
   - Implements ONLY what the report specifies — nothing more, nothing less
   - If the report is ambiguous or incomplete, asks you for clarification (does NOT guess)

5. **MONITOR** — Wait for implementers to complete. Do NOT implement tasks yourself — delegate only.
   - If an implementer gets stuck, provide guidance
   - If an implementer fails 3x, reassign or ask user

6. **QUALITY** — After all implementers complete, spawn quality teammates:
   - Spawn a `/qual` teammate to run multi-lens quality analysis on all changed files
   - Spawn a `/lint` teammate to run all quality gates (lint, typecheck, tests, build)
   - Wait for both to complete

7. **FIX** — If quality teammates find issues:
   - Critical/High issues: spawn fix teammates to resolve them
   - Re-run `/lint` after fixes
   - Repeat until clean or ask user if blocked

8. **REPORT** — Output completion summary:

```
## Summary
<what was accomplished>

### Work Units
| Unit | Analyzer | Implementer | Status | Files |
|------|----------|-------------|--------|-------|

### Quality
| Check | Status | Issues |
|-------|--------|--------|
| /qual | PASS/FAIL | N critical, N high |
| /lint | PASS/FAIL | details |

### Issues / Deferred
<if any>
```

## Constraints

- **Analyze before implement** — Never spawn implementers until all analyzers finish. The analysis report is the single source of truth.
- **Hard role separation** — Analyzers never edit. Implementers follow the report, not their own exploration.
- **Delegate only** — Never implement tasks directly.
- **Parallel by default** — Analyzers run in parallel. Implementers run in parallel (after all analyzers complete).
- **No artificial teammate cap** — Scale work units to the task.
- **Wait for completion** — Do not proceed to next phase until current phase teammates finish.
- **Quality is mandatory** — Never report done without /qual and /lint passing.

## Team Lifecycle

1. **Create team** — Use `TeamCreate` before spawning any teammates.
2. **Spawn teammates** — Always use `Task` tool with `team_name` parameter. Never use standalone `Task` calls without `team_name`.
3. **Communicate** — Use `SendMessage` for all teammate communication. Plain text output is NOT visible to teammates.
4. **Shutdown** — After reporting results, send `shutdown_request` to all active teammates, then use `TeamDelete` to clean up.
