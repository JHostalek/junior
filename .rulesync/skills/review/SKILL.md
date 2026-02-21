---
name: review
description: Review a pull request or code changes for quality, security, and correctness. Use when reviewing PRs or recent code changes.
disable-model-invocation: true
argument-hint: [PR number or path]
---

target = $ARGUMENTS

If target is not provided, review the PR/MR of the current branch.

## Platform Detection

Before fetching PR/MR data, detect the git hosting platform:

1. **Read remote URL**: `git remote get-url origin`
2. **Match hostname**:

| Hostname pattern | Platform | CLI | Install |
|-----------------|----------|-----|---------|
| `github.com` | GitHub | `gh` | `brew install gh` / https://cli.github.com |
| `gitlab.com` or `gitlab.*` | GitLab | `glab` | `brew install glab` / https://gitlab.com/gitlab-org/cli |
| `dev.azure.com` or `ssh.dev.azure.com` or `*.visualstudio.com` | Azure DevOps | `az` | `brew install azure-cli` / https://aka.ms/install-azure-cli |

3. **If hostname doesn't match any pattern**: Ask the user which platform they're using
4. **Verify CLI is available**: Run `command -v <cli>` — if missing, tell the user which tool to install (use the table above) and stop

## Fetching the Diff

Use the detected platform CLI to get the PR/MR diff:

**GitHub** (`gh`):
```
gh pr view <target> --json files,additions,deletions
gh pr diff <target>
```

**GitLab** (`glab`):
```
glab mr view <target>
glab mr diff <target>
```

**Azure DevOps** (`az`):
```
az repos pr show --id <target>
az repos pr list --status active  # if no target, find PR for current branch
```

If target is a local path (not a number), skip platform detection and use `git diff` directly.

## Review Checklist

1. **Diff Analysis:**
   - What changed? (files, lines added/removed)
   - Is scope appropriate? (not too large, not mixing concerns)
   - Any files that shouldn't be in this PR/MR?

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

## Submitting Review (if requested)

Use the detected platform CLI:

**GitHub** (`gh`):
```
gh pr review <target> --approve --body "<summary>"
gh pr review <target> --request-changes --body "<summary>"
```

**GitLab** (`glab`):
```
glab mr approve <target>
glab mr note <target> --message "<summary>"
```

**Azure DevOps** (`az`):
```
az repos pr set-vote --id <target> --vote approve
az repos pr update --id <target> --description "<summary>"
```

Only submit a review if the user explicitly asks — default is local report only.
