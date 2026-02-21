---
name: pr
description: Create a pull request from the current worktree branch. Commits uncommitted changes, pushes, and opens a PR with conventional formatting.
disable-model-invocation: true
---

## Prerequisites

- MUST be on a non-main branch (error if on `main` or `master`)
- Platform CLI must be installed and authenticated (see Platform Detection)

## Platform Detection

Before anything else, detect the git hosting platform:

1. **Read remote URL**: `git remote get-url origin`
2. **Match hostname**:

| Hostname pattern | Platform | CLI | Install |
|-----------------|----------|-----|---------|
| `github.com` | GitHub | `gh` | `brew install gh` / https://cli.github.com |
| `gitlab.com` or `gitlab.*` | GitLab | `glab` | `brew install glab` / https://gitlab.com/gitlab-org/cli |
| `dev.azure.com` or `ssh.dev.azure.com` or `*.visualstudio.com` | Azure DevOps | `az` | `brew install azure-cli` / https://aka.ms/install-azure-cli |

3. **If hostname doesn't match any pattern**: Ask the user which platform they're using
4. **Verify CLI is available**: Run `command -v <cli>` — if missing, tell the user which tool to install (use the table above) and stop

## Execution

1. **Verify branch**: `git branch --show-current` — abort with guidance if on main/master

2. **Detect platform**: Follow Platform Detection above

3. **Handle uncommitted changes**: Run `git status`
   - If uncommitted changes exist, commit them following `/git` conventions (conventional commit, specific file staging)
   - If working tree is clean, skip to push

4. **Push branch**: `git push -u origin <branch-name>`

5. **Gather PR context**:
   - `git log main..HEAD --oneline` for commit history
   - `git diff main...HEAD --stat` for changed files summary

6. **Create PR/MR** using the PR Body Template below (platform-specific):

   **GitHub** (`gh`):
   ```
   gh pr create --title "<title>" --body "<body>"
   ```

   **GitLab** (`glab`):
   ```
   glab mr create --title "<title>" --description "<body>"
   ```

   **Azure DevOps** (`az`):
   ```
   az repos pr create --title "<title>" --description "<body>" \
     --source-branch <branch> --target-branch main
   ```

7. **Report**: Output the PR/MR URL

## PR Title

- Conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
- ≤70 chars, imperative mood
- Derive from commit history — if single commit, reuse its message; if multiple, summarize

## PR Body Template

Format using heredoc. Fill every section. No filler, no preamble, no "this PR does X" — fragments over sentences. Match the voice of the project README.

**Writing rules:**
- Lead with what, not "This PR adds..." — just state the thing
- Fragments > full sentences when meaning is clear
- One line per change. No paragraph explanations.
- Delete anything a reviewer can see from the diff

```
$(cat <<'EOF'
## Task

Resolves #<issue-number>
<!-- no issue? one-line description of what triggered this. -->

## Summary

<!-- what changed + why. terse. no "This PR implements..." — just state it. -->
<!-- approach choice? one line: "X over Y because Z." -->

## Changes

<!-- one bullet per change. grouped by area. flag out-of-scope changes. -->

-

## Verification

- [ ] build passes
- [ ] tests pass (new + existing)
- [ ] lint/format clean

## Review Guidance

**confidence:** high | medium | low
**highest-risk:** <!-- where to focus review -->

## Checklist

### scope
- [ ] changes limited to requested task
- [ ] no unrelated formatting, refactoring, or "improvements"
- [ ] no new deps (or justified + verified in registry)

### correctness
- [ ] no hallucinated imports or API calls
- [ ] no placeholder/example content in production code
- [ ] error handling present (no empty catch blocks)
- [ ] edge cases: empty input, null, large data

### security
- [ ] no hardcoded secrets/keys/credentials
- [ ] user input validated/sanitized
- [ ] DB queries parameterized
- [ ] no new eval()/exec()/innerHTML with user data

### tests
- [ ] tests assert meaningful behavior (would fail if feature broke)
- [ ] negative/failure cases included
- [ ] not tautological (testing code equals itself)

EOF
)
```

## What This Skill Does NOT Do

- Create or manage worktrees (use Claude Code's `EnterWorktree`)
- Clean up worktrees (Claude Code prompts on session exit)
- Merge PRs (that's a review/merge workflow)

## Dangerous Operations (require explicit user confirmation)

- Force-pushing (`--force`)
- Creating PRs against non-default base branches
- Pushing to a branch that already has an open PR (offer to update instead)
