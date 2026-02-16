---
name: lint
description: Run all quality gates (format, lint, typecheck, tests, build) and report results. Use after implementation or before committing.
disable-model-invocation: true
argument-hint: [path]
---

lint_path = $ARGUMENTS

If lint_path is not provided, run quality gates on entire codebase.
If lint_path is provided, focus linting on that specific path.

## Execution Order

1. Lint + Format: `bun run lint:fix`
2. Typecheck: `bun run typecheck`
3. Tests: `bun run test`
4. Build: `bun run build`

## Output

| Gate      | Status    | Issues               |
| --------- | --------- | -------------------- |
| Lint      | PASS/FAIL | — or N files changed |
| Typecheck | PASS/FAIL | — or N errors        |
| Tests     | PASS/FAIL | N/M passed           |
| Build     | PASS/FAIL | — or error           |

If failures: list top 3 issues with `file:line`, not full error dump.

Do NOT commit or push.
