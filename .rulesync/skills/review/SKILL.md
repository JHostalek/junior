---
name: review
description: Review a pull request or code changes for quality, security, and correctness. Use when reviewing PRs or recent code changes.
disable-model-invocation: true
argument-hint: [PR number or path]
---

target = $ARGUMENTS

If target is not provided, review the PR of the current branch.

## Review Checklist

1. **Diff Analysis:**
   - What changed? (files, lines added/removed)
   - Is scope appropriate? (not too large, not mixing concerns)
   - Any files that shouldn't be in this PR?

2. **Code Quality:**
   - Follows project patterns and conventions?
   - Types correct and complete?
   - Error handling present (JuniorError hierarchy)?
   - No dead code or commented-out code?

3. **Tests:**
   - New code tested?
   - Edge cases covered?
   - No skipped/disabled tests added?

4. **Security:**
   - Input validation present (Zod)?
   - No secrets in code?
   - No command injection risks (Bun.spawn with array args)?

5. **Performance:**
   - N+1 queries avoided?
   - Appropriate use of async?
   - Large data sets handled?

6. **Over-Engineering Check** (LLM-specific):
   - Unnecessary abstraction that fragments logic?
   - Patterns added "for future flexibility" that isn't needed?

## Output

| Category    | Status   | Notes      |
| ----------- | -------- | ---------- |
| Scope       | PASS/FAIL | Brief note |
| Quality     | PASS/FAIL | Brief note |
| Tests       | PASS/FAIL | Brief note |
| Security    | PASS/FAIL | Brief note |
| Performance | PASS/FAIL | Brief note |

**Issues Found:** (if any)
- `file:line` — issue description → suggested fix

**Verdict:** APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION
