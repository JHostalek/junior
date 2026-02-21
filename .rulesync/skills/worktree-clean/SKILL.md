---
name: worktree-clean
description: Remove a completed git worktree and its branch after a feature is merged or PR is created. Use from the main repo, not from inside the worktree.
argument-hint: [worktree-path]
---
worktree_path = $ARGUMENTS

Clean up a completed worktree.

## Execution

1. Verify the current working directory is NOT inside the worktree being removed (must run from main repo)

2. If worktree_path is not provided:
   - List all worktrees: `git worktree list`
   - Ask the user which worktree to remove

3. Identify the branch name from the worktree (parse from `git worktree list` output)

4. Remove the worktree:
   ```
   git worktree remove {worktree_path}
   ```
   If it fails due to unclean state, inform the user and ask whether to force with `--force`.

5. Delete the branch:
   ```
   git branch -d {branch_name}
   ```
   Uses `-d` (safe delete) — fails if branch is unmerged. If user confirms, use `-D` to force.

6. Prune stale worktree references:
   ```
   git worktree prune
   ```

7. Show remaining worktrees: `git worktree list`
