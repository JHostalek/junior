---
root: true
description: "Project configuration and best practices for AI agents"
targets: ["*"]
---

# CLAUDE.md

## Project Context

Read project-specific context from the repository's `CLAUDE.md`:
- Stack, architecture, commands, conventions, gotchas

This file is the source of truth for project-specific information. If it doesn't exist, ask the user to provide project context.

## Commands

**TypeScript/Bun:**

```bash
bun run build              # Compile to standalone binary
bun run typecheck          # TypeScript type checker (tsc --noEmit)
bun run test               # Run tests (Bun built-in runner)
bun run lint               # Lint with Biome
bun run lint:fix           # Auto-fix lint issues
bun run check              # Typecheck + lint
bun add <package>          # Add dependency
```

**Configuration:**
- Environment variables: centralized in `core/flags.ts` (`Flag` namespace)

---

## Communication Style

Terse, peer-to-peer. Talk to the user like a colleague, not a student.

- **CS-1 (MUST):** No preamble. No "Great question!", "Sure!", "Let me help you with that." Start with the substance.
- **CS-2 (MUST):** No recap or narration. If the user can see the diff, don't explain what changed. If the tool output shows the result, don't restate it.
- **CS-3 (MUST):** No filler. Cut "I'll now proceed to", "Let's go ahead and", "As mentioned earlier". Just do the thing.
- **CS-4 (MUST):** No hedging walls. One caveat is fine. Three paragraphs of "however, it's worth noting that..." is not.
- **CS-5 (MUST):** Fragments > full sentences when meaning is clear. "Fixed. Tests pass." not "I have fixed the issue and verified that all tests are now passing successfully."
- **CS-6 (MUST):** No unsolicited advice. Don't suggest improvements, next steps, or "you might also want to" unless asked.
- **CS-7 (MUST):** Match the user's energy. Short question = short answer. Detailed question = detailed answer. Don't inflate.
- **CS-8 (SHOULD):** When reporting results, lead with outcome. "All 47 tests pass" not "I ran the test suite using bun test and here are the results..."

---

## Implementation Best Practices

### 0 — Purpose

These rules optimize for **LLM-maintained codebases**. The primary code maintainers are AI coding agents, not humans. Rules that optimize for human cognitive limits may be counterproductive here.

**LLM Maintainability Principles:**

| Human Constraint | LLM Constraint | Implication |
|------------------|----------------|-------------|
| Limited working memory | Limited context window | Compact code > verbose docs |
| Reads linearly | Reads holistically but loses cross-file context | Cohesive files > fragmented logic |
| Needs comments | Infers from types + names | Type annotations > prose JSDoc |
| Struggles with long functions | Struggles with scattered logic | One clear purpose per file |

**Key Guidelines:**

- **Type annotations are documentation** — LLMs read code faster than prose. Strong typing > verbose JSDoc.
- **Cohesion over line counts** — A 500-line file with one clear purpose is better than 5 files that fragment logic.
- **Discoverability matters** — File names and structure help LLMs classify relevance during exploration. Mixed-concern files get misclassified.
- **Challenge over-engineering** — Abstraction that fragments logic hurts LLM comprehension. Prefer direct solutions.

**Modern First:** Target modern language features and idioms:

- **TypeScript**: Strict mode, ESM, Bun runtime, Zod validation
- Write code that fully utilizes expressiveness and capabilities of modern tools

**Documentation:** `/docs/` files MUST be information-dense. Every line must justify its existence. See Section 8 for guidelines.

---

### 1 — Before Coding

- **BP-1 (MUST):** Ask the user clarifying questions to understand domain, constraints, and expected behavior.
- **BP-1a (MUST):** For debugging: First explore codebase to understand data model and flow; only if exploration is insufficient, request explanation and minimal reproduction case BEFORE adding any debug code.
- **BP-2 (MUST):** Draft and confirm an approach for complex work.
- **BP-3 (SHOULD):** Search the codebase and web for relevant implementations using the same technologies to leverage domain context.
- **BP-4 (SHOULD):** If two or more approaches exist, list clear pros and cons for each.

---

### 1a — Execution Discipline

**Scope (CRITICAL):**

- **EX-1 (MUST):** Do what has been asked; nothing more, nothing less.
- **EX-2 (MUST):** NEVER add features, edge cases, or fallbacks not explicitly requested.
- **EX-3 (MUST):** NEVER create documentation files unless explicitly requested.
- **EX-4 (SHOULD NOT):** Propose "improvements" after completing the task. If follow-up is valuable, mention it briefly — don't implement.

**Verification Before Acting:**

- **EX-5 (MUST):** Read files before modifying — never edit code you haven't seen this session.
- **EX-6 (MUST):** Never invent file paths, APIs, or commands. Verify with tools first.
- **EX-7 (MUST):** Before editing, gather ALL symbols involved in a SINGLE search/read operation:
  - Classes, methods, properties you will modify
  - Their dependencies and imports
  - Their callers and usages
  - Do NOT make multiple sequential searches — batch into one call.

**Progress Checkpoints:**

- **EX-8 (MUST):** After 3-5 tool calls OR editing 3+ files, pause and post a compact checkpoint: what you did, key results, what's next.
- **EX-9 (MUST):** Don't restate unchanged plans. Report deltas only.

**3-Strike Rule:**

- **EX-10 (MUST):** If same fix attempt fails 3 times on same file/test/CI, STOP and ask user for help.
- **EX-11 (MUST):** If same search query returns insufficient results twice, refine the query — don't repeat it.
- **EX-12 (MUST):** If you notice yourself going in circles (calling same tool repeatedly without progress), STOP and ask user for different approach.

**Under-Specification:**

- **EX-13 (SHOULD):** If details are missing but non-blocking, infer 1-2 reasonable assumptions from codebase conventions. Note assumptions briefly and proceed.
- **EX-14 (MUST):** Ask only when truly blocked or when choice has significant consequences.

---

### 1b — Think Before Concluding

- **TC-1 (MUST):** Before stating any conclusion, consider multiple explanations/approaches/answers. Never present the first plausible answer as the answer.
- **TC-2 (MUST):** Distinguish what you know from what you're inferring. State assumptions explicitly.
- **TC-3 (MUST):** When new information arrives, re-evaluate all possibilities — don't force-fit it into your current theory.

---

### 1c — Engineering Mindset

**Contract Before Code:**

- **EM-1 (SHOULD):** For non-trivial changes, outline a tiny "contract" in 2-4 bullets before implementing:
  - Inputs (types, sources)
  - Outputs (types, destinations)
  - Error modes (what can fail, how handled)
  - Success criteria (how to verify it works)

**Edge Case Awareness:**

- **EM-2 (SHOULD):** For complex logic, consider 3-5 likely edge cases:
  - Data: empty/null, very large, malformed
  - Performance: slow responses, timeouts
  - Concurrency: race conditions, stale data
- **EM-3 (MUST):** Only handle edge cases explicitly requested or obviously critical. Don't over-engineer.

**Quality Gates (in order):**

- **EM-4 (MUST):** Before marking work complete, run gates in sequence:
  1. Build (compiles without errors)
  2. Lint/Format (`biome`)
  3. Typecheck (`tsc`)
  4. Tests (`bun test`)
- **EM-5 (MUST):** Report gate results as deltas: PASS/FAIL only. Don't dump full output.

**Root Cause vs Symptom:**

- **EM-6 (MUST):** When debugging, address root cause — not symptoms.
- **EM-7 (MUST):** When tests fail, assume code is wrong first — not the test. Only modify tests if task explicitly requires it.
- **EM-8 (SHOULD):** Before concluding root cause, gather information. Don't guess.

---

### 1d — Dangerous Actions (STOP and Ask First)

Before ANY of these actions, STOP and get explicit user permission:

| Action                            | Why Dangerous                      |
| --------------------------------- | ---------------------------------- |
| `git commit` / `git push`         | Permanent history change           |
| `git merge` / `git rebase`        | Can lose work                      |
| Installing dependencies           | Changes project requirements       |
| Deploying to any environment      | Production impact                  |
| Deleting files outside task scope | Data loss                          |

**Exception:** Read-only operations (`git status`, `git diff`, `git log`) do not require permission.

**NEVER use `git checkout -- <file>` or `git restore <file>` to revert changes.** In multi-agent workflows, other agents may have uncommitted changes to the same or other files. These commands restore files to their last committed state, silently destroying any uncommitted work across the working tree. If you need to undo your own changes, use targeted edits to reverse them manually.

---

### 2 — While Coding

#### General Principles

- **C-1 (SHOULD):** Write tests for domain knowledge that might be forgotten. Tests catch context loss between features (e.g., Feature B breaks Feature A's assumptions). Skip tests that just verify "code does what code says."
- **C-2 (MUST):** Use existing domain vocabulary for naming functions/components for consistency.
- **C-2a (MUST):** Before implementing, search for similar features in the codebase. Match existing patterns for:
  - Data access (Drizzle queries, raw SQL)
  - Error handling (throw vs return null vs JuniorError subclass)
  - Service patterns (async patterns, Bun.spawn())
  The codebase teaches conventions. Don't invent new patterns when one exists.
- **C-3 (SHOULD NOT):** Introduce classes/components when small, testable functions suffice.
- **C-4 (SHOULD):** Prefer simple, composable, testable functions.
- **C-5 (MUST):** Do not add inline code comments that explain what the code does; write self-explanatory code. Only add comments for non-obvious caveats, business logic rationale, or complex algorithms when necessary.
- **C-6 (SHOULD NOT):** Extract a new function/component unless it will be reused, is the only way to unit-test otherwise untestable logic, or drastically improves readability. Prefer extraction when it materially enhances readability or testability; avoid unnecessary micro-functions/components.
- **C-7 (SHOULD):** Keep modules focused on a single concern. Size follows from cohesion, not arbitrary limits. A 600-line file with one clear purpose is better than 6 files that fragment logic. Split when concerns are mixed, not when line counts are high.
- **C-8 (SHOULD):** Use explicit error handling with meaningful exceptions:
  - Throw domain-specific errors (JuniorError subclasses, not generic `Error`)
  - Log errors with structured context (JSON format)
  - Never silently catch exceptions without logging
- **C-XX (MUST):** Challenge over-engineering. If a rule or requirement forces abstraction, indirection, or complexity that obscures the direct solution, push back. The cost of over-engineering is high: future LLMs waste tokens navigating unnecessary structure and may misunderstand abstracted intent.
- **C-DF (MUST):** Design for deletion. Prefer **feature-local module + single integration point** over threading new arguments through many call sites. The "deletion test": if the feature is removed, you should delete **1 module + 1 wiring call**, not hunt references across 10 files. When choosing between approaches, pick the one with fewer cross-file touchpoints.

#### TypeScript Patterns

- **C-14 (MUST):** Use strict TypeScript with explicit types for all function signatures and exported values:
  - Use `Type | undefined` not `Type | null` unless null is semantically meaningful
  - Use Zod schemas for runtime validation at system boundaries
  - Use `satisfies` for type narrowing on object literals
- **C-15 (SHOULD):** Use Zod for data validation and serialization at boundaries.
- **C-16 (MUST):** Follow naming conventions: `camelCase` for functions/variables, `PascalCase` for types/classes, `SCREAMING_SNAKE` for constants, `snake_case` for DB columns.
- **C-17 (SHOULD):** Employ modern TypeScript/ESM capabilities to write expressive and concise code.
- **C-18 (MUST):** All imports use explicit `.js` extensions (ESM requirement). Cross-directory imports use `@/*` path aliases.
- **C-19 (MUST):** All process spawning uses `Bun.spawn()` with array args (never `node:child_process`, never shell strings).

#### JSDoc Philosophy (LLM-Maintained Code)

Type annotations are documentation. LLMs read code faster than prose.

**Write JSDoc for:**
- Public APIs — for documentation generation
- Non-obvious behavior — side effects, gotchas, business logic rationale

**Skip JSDoc for:**
- Internal helpers — type annotations + clear names suffice
- Functions where JSDoc would restate the signature
- Private methods — LLMs infer purpose from context

**Good JSDoc** (non-obvious behavior):
```typescript
/** Retries are jittered to prevent thundering herd. Throws last error after exhaustion. */
function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T>
```

**Wasteful JSDoc** (restates signature):
```typescript
/**
 * Get a document by its ID.
 * @param docId - The ID of the document to retrieve.
 * @returns Document if found, undefined otherwise.
 */
function getDocumentById(docId: string): Document | undefined
```

---

### 3 — Testing

#### Testing Philosophy (LLM-Maintained Codebases)

Tests serve two purposes in LLM-maintained code:
1. **Catch context loss** — When Feature B breaks Feature A's assumptions (the LLM forgot context)
2. **Encode domain knowledge** — Business rules that aren't obvious from code alone

Tests that just verify "code does what code says" add maintenance burden without catching real bugs.

**Test what matters:**
- Critical paths (data integrity, job execution flow)
- Complex algorithms with non-obvious edge cases
- Business rules that encode domain knowledge
- Integration points between components

**Skip tests for:**
- Simple CRUD that mirrors the implementation
- Trivial getters/setters
- Framework boilerplate
- Code that would be regenerated identically from tests

#### Test Types & Organization

- **T-1 (MUST):** Understand test types:
  - **Unit tests**: Complex algorithms, business logic (`bun test`)
  - **Integration tests**: Component interactions — **preferred over heavy mocking**
- **T-2 (SHOULD):** Separate pure-logic unit tests from integration tests.
- **T-4 (MUST):** Co-locate test files with source: `src/core/foo.test.ts` next to `src/core/foo.ts`.

#### Test Quality

- **T-5 (SHOULD):** Prefer integration tests over excessive mocking. Mocks test the mock, not the system.
- **T-6 (SHOULD):** Unit-test complex algorithms thoroughly.
- **T-7 (SHOULD):** Test structure in one assertion when possible.
- **T-8 (SHOULD):** Use `expect.any(Type)` for variable fields.
- **T-9 (SHOULD):** Test failure paths and edge cases that encode domain knowledge.
- **T-10 (SHOULD):** Test behavior and outcomes, not implementation details.
- **T-12 (SHOULD):** Use `test.each` / `describe.each` for parameterized tests.

---

### 4 — Security

- **SEC-1 (MUST):** Never commit secrets, API keys, or credentials to git.
- **SEC-2 (MUST):** Use environment variables for all sensitive configuration.
- **SEC-3 (MUST):** Validate and sanitize all user inputs (Zod).
- **SEC-4 (MUST):** Store connection strings and service credentials in `.env` files (gitignored).

---

### 5 — Performance

- **PERF-1 (SHOULD):** Use async for I/O-bound operations (file, process spawning).
- **PERF-2 (MUST):** Avoid N+1 patterns; use batch operations.
- **PERF-4 (SHOULD):** Paginate large result sets.
- **PERF-5 (SHOULD NOT):** Premature optimization; measure before optimizing.

---

### 6 — Structured Logging

- **LOG-1 (MUST):** Use structured JSON logging to stderr: `[ISO_TIMESTAMP] [LEVEL] message {metadata}`.
- **LOG-2 (MUST):** Never use string interpolation in log messages — pass structured fields as metadata.
- **LOG-3 (SHOULD):** Use consistent field names: `taskId`, `jobId`, `operation`, `error`.
- **LOG-4 (SHOULD):** Log at appropriate levels: `error` for failures, `info` for state changes, `debug` for tracing.

---

### 7 — Debugging Strategy

- **DBG-1 (MUST):** Start with domain understanding (explore codebase first) before adding any debug code.
- **DBG-2 (SHOULD):** Use minimal, targeted logging (avoid dumping entire objects).
- **DBG-3 (MUST):** Solve ONE problem completely before moving to the next.
- **DBG-4 (SHOULD):** Remove debug logging after issue is resolved.
- **DBG-5 (MUST):** If user corrects understanding 3+ times on same concept, stop and request domain clarification.

---

### 8 — Documentation (MUST follow for ALL `/docs/` files)

**Core Principle:** Every line must justify its existence. Information-dense, scannable, no fluff.

**DOC-1 (MUST):** Delete ruthlessly:

- No obvious descriptions ("Create new project", "Update metadata")
- No redundant explanations (saying the same thing twice)
- No marketing language ("fully implemented", "production-ready", "powerful")
- No meta-commentary ("Note:", "Important:", "As you can see")
- No full code blocks (use signatures only: `Task: id, title, status`)
- No verbose rationales (one line max)
- No tutorial-style prose (use bullet points)

**DOC-2 (MUST):** Structure:

- Tables for comparisons/decisions
- Bullet lists for features/steps
- Diagrams for architecture
- Code: signatures only, never full implementations
- External links instead of duplicating content

**DOC-3 (MUST):** Before writing, ask: "Can I say this in half the words?" If yes, do it.

---

### 9 — Tooling Gates (All must pass)

- **G-1 (MUST):** Run formatter — no changes remaining.
- **G-2 (MUST):** Run linter with auto-fix — no lint errors.
- **G-3 (MUST):** Run tests — all pass.
- **G-4 (MUST):** NEVER add ignores or suppressions to silence linter errors. Fix the code.

Standard gates: `bun run lint:fix`, `bun run typecheck`, `bun run test`, `bun run build`

---

### 10 — Tool Execution Efficiency

**Parallel Tool Calls (CRITICAL):**

- **TE-1 (MUST):** DEFAULT to parallel tool calls. When reading 3+ files, run all reads in parallel. When searching, run multiple searches with different terms in parallel.
- **TE-2 (MUST):** Only serialize tool calls when output of one is required input for another.
- **TE-3 (MUST):** Limit parallel calls to 3-5 at once to prevent timeouts.
- **TE-4 (SHOULD):** When gathering context, run codebase search + file reads + grep searches simultaneously.

**Tool Prohibitions:**

- **TE-5 (MUST):** NEVER use `cat`, `head`, `tail`, `less` for file reading — use Read tool.
- **TE-6 (MUST):** NEVER use `grep`, `rg`, `find` via Bash — use Grep/Glob tools.
- **TE-7 (MUST):** NEVER use `cd` in commands — use absolute paths or tool's path parameter.
- **TE-8 (MUST):** NEVER use interactive commands (`vim`, `nano`, `less`, `git rebase -i`).
- **TE-9 (MUST):** NEVER use `echo` or `cat` with heredoc to write files — use Write tool.

**Pre-Edit Information Gathering:**

- **TE-10 (MUST):** Before editing ANY file, gather in a SINGLE search call:
  - All symbols you will modify (classes, methods, properties)
  - All dependencies/imports of those symbols
  - All callers/usages of those symbols
- **TE-11 (MUST):** If editing file not read in last 5 tool calls, re-read it first.

---

## Writing Functions Best Practices (Concise)

- Keep functions readable; minimize nesting; use clear domain vocabulary in names.
- Prefer common data structures if they simplify logic; avoid unnecessary conversions.
- Ensure functions are unit-testable without heavy mocking; inject dependencies.
- Avoid extracting micro-functions unless it improves readability/testability or reuse.
- Use modern idioms: destructuring, optional chaining, nullish coalescing, template literals.
- Use proper TypeScript types; avoid `any`.

---

## Writing Tests Best Practices (Concise)

- Use `test.each` / `describe.each` for parameterized tests; avoid magic literals.
- Write tests that can fail for real defects; skip trivial asserts.
- Name tests clearly: `test("functionName when condition then expectation")`.
- Compare outputs to independent expectations or domain properties.
- Follow Biome rules; use `bun:test` imports.
- Group unit tests by module; use `expect.any(Type)` for variable fields.
- Prefer strong assertions. Cover edge cases, realistic, unexpected, and boundary inputs.
