---
name: pr
description: Create a pull request from the current worktree branch. Commits uncommitted changes, pushes, and opens a PR with conventional formatting.
disable-model-invocation: true
---

## Prerequisites

- MUST be on a non-main branch (error if on `main` or `master`)
- `gh` CLI must be authenticated

## Execution

1. **Verify branch**: `git branch --show-current` — abort with guidance if on main/master

2. **Handle uncommitted changes**: Run `git status`
   - If uncommitted changes exist, commit them following `/git` conventions (conventional commit, specific file staging)
   - If working tree is clean, skip to push

3. **Push branch**: `git push -u origin <branch-name>`

4. **Gather PR context**:
   - `git log main..HEAD --oneline` for commit history
   - `git diff main...HEAD --stat` for changed files summary

5. **Create PR**:
   ```
   gh pr create --title "<type>(scope): description" --body "$(cat <<'EOF'
   ## Summary
   <1-3 sentences: what and why>

   ## Changes
   <bulleted list of key changes>

   ## Test plan
   - [ ] <verification steps>
   EOF
   )"
   ```

6. **Report**: Output the PR URL

## PR Title

- Conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
- ≤70 chars, imperative mood
- Derive from commit history — if single commit, reuse its message; if multiple, summarize

## PR Body

Keep it lightweight:
- **Summary**: What changed and why (not how — the diff shows how)
- **Changes**: Bulleted key changes, not exhaustive file lists
- **Test plan**: How to verify the PR works

## What This Skill Does NOT Do

- Create or manage worktrees (use Claude Code's `EnterWorktree`)
- Clean up worktrees (Claude Code prompts on session exit)
- Merge PRs (that's a review/merge workflow)

## Dangerous Operations (require explicit user confirmation)

- Force-pushing (`--force`)
- Creating PRs against non-default base branches
- Pushing to a branch that already has an open PR (offer to update instead)
