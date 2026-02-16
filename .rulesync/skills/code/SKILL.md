---
name: code
description: Execute an implementation plan and run quality gates. Use after /plan produces a plan, or when given specific implementation instructions.
disable-model-invocation: true
argument-hint: [task or plan reference]
---

task = $ARGUMENTS

Implement the plan and ensure quality gates pass.

## Execution Workflow

1. **Pre-implementation verification**: Verify you understand the plan and have all necessary context. If any part is unclear or missing context, STOP and ask for clarification.
2. **Incremental execution**: Implement each step, then verify it works before proceeding.
3. **Testing strategy**: Write tests for domain knowledge that might be forgotten and critical paths. Skip tests that just mirror implementation.
4. **Legacy code removal**: After implementing new code, search for and remove related old/unused code.
5. **Integration verification**: After each step, verify new code integrates properly with existing components.
6. **Self-review checkpoint**: Before finalizing, review for:
   - Completeness: no TODOs, FIXMEs, stubs, or incomplete implementations
   - Correctness: handles all requirements from the plan
7. **Uncertainty handling**: If you encounter ambiguity or lack context, STOP and ask for clarification.

## Code Quality

- Find and fix root causes, not symptoms
- No inline comments explaining WHAT (code should be self-explanatory); comments for WHY are OK
- Strong type annotations (LLM is the primary consumer)
- Remove all legacy and unused code after implementation
- Prefer direct solutions over abstraction that fragments logic

## Loop Limits (3-Strike Rule)

- Same file fails to compile/typecheck/lint 3 times → STOP and ask user
- Same test fails 3 times after different fixes → STOP and ask user
- Repeating same action without progress → STOP immediately

## Quality Gates (run after completing implementation)

1. `bun run lint:fix`
2. `bun run typecheck`
3. `bun run test`
4. `bun run build`

Report: PASS or FAIL with specific error. Don't dump full output.
