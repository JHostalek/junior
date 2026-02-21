---
name: pr
description: Create a pull request from the current worktree branch. Commits uncommitted changes, pushes, and opens a PR with conventional formatting.
---

Create a pull request for the current branch.

## Execution

1. Verify the current branch is NOT main/master — refuse to create PR from default branch

2. If there are uncommitted changes:
   - Stage relevant files (prefer specific files over `git add .`)
   - Commit with conventional commit message (follow `/git` conventions)

3. Push to remote:
   ```
   git push -u origin {branch_name}
   ```

4. Check for existing PR on this branch:
   ```
   gh pr view --json url 2>/dev/null
   ```
   If PR already exists, show the URL and ask if user wants to update it.

5. Gather PR content:
   - Title: short conventional format, ≤70 chars (e.g., `feat(auth): add OAuth2 login flow`)
   - Body: `## Summary` with 1-3 bullet points, `## Test plan` with verification checklist
   - Use `git log main..HEAD` and `git diff main...HEAD` to understand all changes

6. Create PR:
   ```
   gh pr create --title "{title}" --body "{body}"
   ```

7. Return the PR URL

## After PR

Remind the user: switch back to the main repo and run `/worktree-clean` to remove this worktree.
