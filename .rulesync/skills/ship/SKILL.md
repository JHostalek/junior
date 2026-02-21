---
name: ship
description: >-
  Build, tag, and release junior via GitHub. Bumps version, runs quality gates,
  builds binary, commits, tags, and pushes to trigger the release workflow.
---
version_bump = $ARGUMENTS

## Pre-release Checklist

- [ ] All changes committed (clean working tree)
- [ ] No console.log/print in production code
- [ ] No hardcoded secrets or API keys
- [ ] On `main` branch

## Execution

1. **Verify clean state**: `git status` — abort if uncommitted changes

2. **Verify branch**: `git branch --show-current` — abort if not on `main`

3. **Quality gates** (abort on any failure):
   - Lint + Format: `bun run lint:fix`
   - Typecheck: `bun run typecheck`
   - Tests: `bun test`
   - Build: `bun run build`

4. **Version bump**:
   - Read current version from `package.json`
   - If `version_bump` provided, use it (patch/minor/major)
   - If not provided, default to `patch`
   - Compute new version (e.g. 1.0.0 → 1.0.1 for patch)
   - Update version in `package.json` AND `src/index.ts` (Commander `.version()` call)
   - Report: `1.0.0 → 1.0.1`

5. **Confirm with user**: Show new version and ask for go/no-go before committing

6. **Commit version bump**:
   - Stage `package.json` and `src/index.ts`
   - Commit: `chore: bump version to <new_version>`

7. **Tag and push**: `git tag v<new_version> && git push && git push --tags`

8. **Report**:
   - The push of `v*` tag triggers `.github/workflows/release.yml` which:
     - Builds the binary on macOS
     - Creates a GitHub Release with the tarball
     - Triggers Homebrew tap formula update in `JHostalek/homebrew-tap`
   - Link: `https://github.com/JHostalek/junior/actions`
   - Tell user to watch the Actions run for the release + tap update

## Version Locations

Both must be updated in sync:
- `package.json` → `"version": "x.y.z"`
- `src/index.ts` → `.version('x.y.z')`

## What This Skill Does NOT Do

- Build the release tarball (CI does that)
- Update the Homebrew formula (CI triggers tap repo workflow)
- Publish to npm (this project distributes via Homebrew)

## Dangerous Operations (require explicit user confirmation)

- Pushing tags (triggers CI release pipeline)
- Force-pushing
