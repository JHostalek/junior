# Quality Constraints for Auto-Generated Skills

Every skill or rule proposed by Intern must pass ALL of these constraints.
If any constraint fails, the proposal must be revised or rejected.

## The 9 Constraints

### 1. Description Word Limit
- **Rule**: Description must be <= 100 words
- **Why**: Skill descriptions are always in context. The total budget for all skill
  descriptions is ~30,000 chars (~600 chars per skill at 50 skills).
- **Check**: `wc -w <<< "$description"` must return <= 100

### 2. Description Contains Trigger Info
- **Rule**: The description must tell Claude WHEN to invoke the skill.
  Include specific trigger phrases users would say.
- **Why**: Claude uses the description field to decide automatic invocation.
  A description without trigger info means Claude never auto-invokes.
- **Check**: Description contains at least one quoted trigger phrase or explicit
  "Use when..." clause.

### 3. Body Size Limit
- **Rule**: SKILL.md body (everything after frontmatter) must be < 5,000 words
- **Why**: Large skill bodies consume context window when loaded. Keep skills
  focused. Move reference material to `references/` files.
- **Check**: `wc -w` on body content must return < 5,000

### 4. Negative Constraints Required
- **Rule**: Every skill must include at least one explicit "do NOT" statement
- **Why**: Language models respect prohibitions more reliably than implied boundaries.
  Without explicit "don't do X", Claude may over-apply the skill.
- **Check**: Body contains at least one line matching `Do NOT|Don't|NEVER|Must not`

### 5. Disambiguation Table Required
- **Rule**: Every skill must include a "When to Use / When NOT to Use" table
- **Why**: Prevents skill collision — when two skills could match, the table helps
  Claude choose the right one.
- **Check**: Body contains a markdown table with headers containing "Use" and "Not"

### 6. Runtime Gating for Platform-Specific Skills
- **Rule**: If the skill relies on platform-specific tools (e.g., `brew`, `apt`,
  `pbcopy`, Windows-specific paths), add runtime checks.
- **Why**: Skills are often shared across environments. A macOS-only skill should
  not break on Linux.
- **Check**: If skill references platform tools, body includes a platform check
  (e.g., `if [[ "$(uname)" == "Darwin" ]]`)

### 7. Flat Parameter Schemas
- **Rule**: If the skill defines tool parameters, use flat objects with discriminator
  fields. No nested unions.
- **Why**: Language models handle flat schemas more reliably than deeply nested ones.
- **Check**: No parameter definitions with nested objects or union types.

### 8. Confirmation for Destructive Operations
- **Rule**: If the skill performs destructive operations (delete, overwrite, push,
  deploy), it must include a preview-confirm-execute pattern.
- **Why**: User safety. Auto-generated skills must not cause data loss.
- **Check**: If skill uses `rm`, `git push`, `deploy`, `drop`, or similar, body
  includes an explicit confirmation step.

### 9. Context Budget Check
- **Rule**: Adding this skill must not exceed the total 30,000 char description budget.
- **Why**: Once the budget is exhausted, Claude can no longer load all skill descriptions
  and may miss relevant skills entirely.
- **Check**: `current_total_chars + new_description_chars <= 30,000`

## Budget Enforcement

```
Total description budget:  30,000 chars
Warning threshold:         25,000 chars (83%)
Hard cap:                  30,000 chars (100%)

At warning: suggest consolidation opportunities
At hard cap: must deprecate or consolidate before adding
```

## Overlap Detection Thresholds

When comparing a new proposal against existing skills:

| Overlap Type | Threshold | Action |
|-------------|-----------|--------|
| Description keyword overlap | > 70% | Suggest consolidation |
| Tool chain fingerprint match | > 80% | Merge into existing |
| Trigger phrase overlap | > 60% | Add disambiguation or merge |

## Anti-Bloat Rules

1. **Minimum evidence**: Require >= 2 occurrences across >= 2 sessions
2. **Provenance tracking**: Every proposal links to source sessions
3. **30-day cooldown**: Rejected proposals not re-proposed for 30 days
4. **Consolidation first**: Suggest merges before new skills when overlap detected
5. **One in, one out** (optional): When at >80% budget, deprecate before adding
