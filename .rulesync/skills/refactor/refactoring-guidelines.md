# Refactoring Dimensions & Verification Gates

Reference catalog for the `/refactor` skill. See `SKILL.md` for workflow and orchestration.

---

## Dimensions

### 1. Strong Typing (CRITICAL)

Eliminate `any`. Every signature explicitly typed. Use strict TypeScript — no implicit `any`, no type assertions without justification.

**Threshold**: 0 `any` types

### 2. Silent Failure Removal (CRITICAL)

DELETE: silent fallbacks on required data, empty catch blocks, swallowed errors. Default values ONLY for truly optional data.

**Exceptions**: Accumulator patterns, optional dependencies with undefined check.

**Threshold**: 0 silent fallbacks on required data

### 3. Dead Code Removal (CRITICAL)

DELETE: Unused exports, test-only code in production, unused imports/deps, commented-out code, unreachable code, TODO-marked removals, DEPRECATED code.

**Exceptions**: Framework entry points, type-only exports used in production.

**Threshold**: 0 unused code

### 4. Error Boundary Coverage

Errors caught at boundaries, displayed meaningfully. All async operations have error handling. Use JuniorError hierarchy.

### 5. Structural Proportionality (CRITICAL)

Architecture must be proportionate to actual complexity.

**Test:** Describe the module's job in one sentence. Count files and classes. If a module does one thing but has 5+ files or 3+ classes — it's over-built.

**Common violations:**
- Classes used in one place → replace with functions
- Inheritance/ABC with one child → inline
- Separate files for <50 lines of related logic → merge
- "Service" classes that wrap one function → delete the class

**Bias toward deletion.** Functions > classes. Fewer files > more files. Inline > abstract.

### 6. Code Duplication

Extract if duplicated 3+ places. DON'T extract coincidental similarity or framework boilerplate.

### 7. Magic Values

Every literal with domain meaning gets a named constant. Exceptions: 0, 1, -1, true, false, empty string.

### 8. Null Safety

Validate at entry, types reflect guarantee after validation. No deep optional chaining (≤2 levels).

### 9. Async Consistency

All async ops handle cleanup, cancellation, race conditions. Use Bun.spawn() patterns consistently.

### 10. Naming Consistency

camelCase (vars/funcs), PascalCase (types/classes), SCREAMING_SNAKE (constants). snake_case for DB columns. 100% adherence.

### 11. Import Organization

Order: external → internal (absolute `@/*`) → relative (`./`). All imports use explicit `.js` extensions. 0 unused imports, 0 circular deps.

### 12. Test Coverage (Domain Knowledge Focus)

Tests encode domain knowledge, not mirror implementation. Must test: critical paths, complex algorithms, business rules, integration points.

### 13. Performance Antipatterns

0 N+1 patterns. No unnecessary re-renders in Ink components. Expensive computations memoized.

### 14. Security Hygiene

0 hardcoded secrets. Parameterized queries (Drizzle ORM). Validated user input (Zod). No secrets in logs. Array args for Bun.spawn() (no shell injection).

### 15. Repository Structure

Feature-based organization. Colocate files that change together. Flat > nested (<4 levels). `core/` only for code reused by 2+ modules.

### 16. Dependency Health

0 vulnerabilities, 0 unused deps. Tools: `bun audit` (if available), manual review of package.json.

### 17. Code Complexity (LLM-Aware)

Nesting depth ≤3. Prefer longer cohesive functions over call-graph navigation. Don't extract helpers just to reduce line counts. Classes used in exactly one place should be functions unless they manage state.

### 18. API Consistency

Uniform CLI command design, predictable naming, standard error format via JuniorError hierarchy.

### 19. Configuration Hygiene

Environment variables centralized in `core/flags.ts` (Flag namespace). No `process.env` access outside flags module. Config validated with Zod.

### 20. Pattern Consistency (CRITICAL)

Same problem → same solution. Dominant pattern (>60%) wins unless clearly inferior.

**Categories**: Data access, error handling, async patterns, service patterns, validation.

**Process**: Count occurrences → identify dominant → locate outliers → assess justification → unify.

**Justified variance**: External library requirements, proven performance needs, framework boundaries.

---

## Verification Gates

### Automated Gates

| Dimension | Gate Command | Pass Criteria |
|-----------|-------------|---------------|
| 1. Strong Typing | `bun run typecheck` | 0 errors, no `any` types |
| 3. Dead Code | Manual unused export search | 0 unused code |
| 10. Naming | `bun run lint` | 0 naming violations |
| 11. Imports | `bun run lint` | 0 import ordering issues |
| 14. Security | Search for hardcoded secrets | 0 hardcoded secrets |
| 19. Config | Search for `process.env` outside `core/flags.ts` | 0 direct env access outside flags |

### Manual Gates

For dimensions without automated gates (4, 5, 6, 8, 9, 12, 13, 15-18, 20): document evidence in report (files reviewed, patterns found/fixed, what remains).

### Completion

Refactor is complete ONLY when:
- All dimensions show PASS or DEFERRED (with justification)
- All quality gates pass (`bun run lint:fix`, `bun run typecheck`, `bun run test`, `bun run build`)
- A final summary lists: dimensions passed, issues fixed (count), issues deferred (count + reasons)
