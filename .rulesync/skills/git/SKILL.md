---
name: git
description: Commit and push changes following conventional commits. Use when ready to commit completed work.
disable-model-invocation: true
---

## Pre-commit Verification

- [ ] No console.log/print statements left in production code
- [ ] No hardcoded secrets or API keys
- [ ] No TODO/FIXME left without tracking issue
- [ ] All imports used, no dead imports

## Execution

1. Check what changed: `git status` and `git diff`

2. Stage relevant files (prefer specific files over `git add .`)

3. Commit with conventional commit message:
   - Format: `<type>(scope): <description>` — description ≤50 chars, imperative
   - Types: feat (MINOR), fix (PATCH), refactor, docs, test, chore, perf, ci, build
   - Breaking changes: `feat!:` or footer `BREAKING CHANGE: description`
   - Full spec: `.rulesync/rules/conventional-commits.md`

4. Push to remote

## Commit Message Rules

- MUST be information-dense
- MUST use imperative mood ("add" not "added")
- Delete: obvious descriptions, implementation details visible in diff, status updates, meta-commentary

## Dangerous Operations (require explicit user confirmation)

- `git push --force` to any branch
- `git reset --hard`
- Deleting remote branches
- Amending pushed commits
- Rebasing shared branches
- Force push to main/master (WARN user even if requested)
