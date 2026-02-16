---
name: refactor
description: Execute comprehensive codebase refactoring with architectural analysis, quality dimensions, and parallel agent teams per module. Use when you have dedicated time for deep codebase improvement.
disable-model-invocation: true
argument-hint: [path]
---

refactor_path = $ARGUMENTS

You are the team lead. Orchestrate a codebase refactoring using three phases with strict role separation.

**Scope:**
- If refactor_path NOT provided: refactor entire codebase
- If refactor_path PROVIDED: analyze full codebase but only refactor files within refactor_path
- If "unused" code may be dynamically selected (env/config/feature-flags): ASK USER before deleting

**Execution model:** Auto-apply everything. Git is the safety net.

Consult [refactoring-guidelines.md](refactoring-guidelines.md) for dimension definitions and verification gates.

## Phase 1: Structural Surgery (Lead Solo)

You do this yourself. These dimensions change what files exist — must be done before delegating module work.

**Dimensions:** 3 (Dead Code) → 5 (Structural Proportionality) → 15 (Repo Structure)

1. **Dependency graph** — Map all module imports. Identify unused files, unused exports, circular deps, god modules, mixed-concern files.
2. **Structural proportionality** — For each module/directory: describe its job in one sentence. Count files and classes. If disproportionate, plan merges/deletions.
3. **Roadmap** — Document: FILES_TO_DELETE, FILES_TO_MERGE, FILES_TO_SPLIT, UNUSED_EXPORTS, CYCLES_TO_BREAK
4. **Execute** — Apply roadmap. Delete dead files, merge fragments, inline single-use classes to functions, break cycles.
5. **Verify** — Run quality gates. 0 unused files, 0 unused exports, 0 cycles. Tests pass.

After Phase 1, the codebase shape is stable. No more file creation/deletion/merging in later phases.

## Phase 2: Code Quality Sweep (Parallel Per Module)

**Dimensions:** 1, 2, 4, 6, 7, 8, 9, 10, 13, 17 — all local to files, no cross-module dependencies.

### 2a: Analyze

Spawn **read-only analyzer teammates** in parallel (one per module). Each analyzer:
- Uses only Glob, Grep, Read (no Edit, Write, Bash)
- Checks its module against all Phase 2 dimensions
- Produces a **written report** with:
  - Findings per dimension: file:line, issue, fix
  - Dependency order for fixes (types before null safety, etc.)
  - Acceptance criteria

The report is the **hard contract** — nothing outside it gets implemented.

**Dimension dependency order within each module:**

```
Batch A: 1 (Strong Typing)
Batch B: 2 (Silent Failures), 4 (Error Boundaries), 8 (Null Safety)  ← depend on types
Batch C: 6, 7, 9, 10, 13, 17  ← independent, any order
```

### 2b: Implement

After ALL analyzer teammates complete, spawn **implementer teammates** (one per module). Each implementer:
- Receives its analyzer's report as sole instructions
- Implements in the batch order specified
- Runs quality gates after each batch
- If ambiguous or blocked, asks you — does NOT guess

### 2c: Verify

Wait for all implementer teammates to complete. Run `/lint` across all modules. Fix failures sequentially.

## Phase 3: Cross-Cutting Concerns (Lead + Specialists)

**Dimensions:** 11, 12, 14, 16, 18, 19, 20 — these span modules and need a global view.

### 3a: Analyze

Spawn **read-only specialist teammates** in parallel:

| Teammate | Dimensions | Focus |
|----------|-----------|-------|
| Pattern analyst | 20, 18 | Pattern consistency + API consistency across codebase |
| Security analyst | 14, 19 | Secrets, config hygiene, input validation |
| Dependency analyst | 11, 16 | Import organization, dependency health |
| Test analyst | 12 | Test coverage gaps against refactored code |

Each produces a findings report.

### 3b: Implement

Triage specialist reports. Spawn implementer teammates for non-conflicting work. Serialize changes that touch shared files.

### 3c: Verify

Run `/lint`. All quality gates must pass.

## Report

```
## Summary
<what was accomplished>

### Phases
| Phase | Dimensions | Status | Files Changed |
|-------|-----------|--------|---------------|

### Dimension Status
| # | Dimension | Status | Issues Fixed | Deferred |
|---|-----------|--------|-------------|----------|

### Quality
| Check | Status |
|-------|--------|
| /lint | PASS/FAIL |
```

## Constraints

- **Phase order is strict** — Never start Phase 2 before Phase 1 completes. Never start Phase 3 before Phase 2 completes.
- **Analyze before implement** — Never spawn implementers until all analyzers in that phase finish.
- **Hard role separation** — Analyzers never edit. Implementers follow the report.
- **Delegate, don't implement** — Lead does Phase 1 only. Phases 2-3 are delegated.
- **3-Strike Rule** — Same file fails 3 times → stop, ask user.
- **Team lifecycle** — Use `TeamCreate` at the start. Spawn all work via the `Task` tool with `team_name` parameter. When done, send `shutdown_request` to all teammates and `TeamDelete` to clean up.
