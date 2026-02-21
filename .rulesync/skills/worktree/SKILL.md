---
name: worktree
description: Create a git worktree in /tmp for isolated feature development. Use when starting work on a new feature branch.
argument-hint: <branch-name>
---
branch_name = $ARGUMENTS

Set up isolated feature development with git worktrees.

## Execution

1. If branch_name is not provided, ask the user for a branch name (e.g., `feature/new-auth`)

2. Derive worktree directory:
   - repo_name = basename of git root directory
   - branch_slug = branch_name with `/` replaced by `-`
   - directory = `/tmp/{repo_name}-{branch_slug}`

3. Create worktree:
   ```
   git worktree add -b {branch_name} {directory} HEAD
   ```
   If the branch already exists, use `git worktree add {directory} {branch_name}` instead.

4. Show the user:
   - Worktree path created
   - Command to open in a new Claude Code session: `claude --cwd {directory}`
   - Lifecycle reminder: use `/git` to commit, `/pr` to create PR, then `/worktree-clean` from the main repo to clean up

5. Symlink essential gitignored files/dirs from the main repo into the worktree so tooling works:
   - `node_modules` (for commitlint, build tools)
   - `.env` (if present)
   Only symlink — never copy.

6. List all active worktrees: `git worktree list`
