---
name: ship
description: >-
  Release junior. Bumps version, runs quality gates, creates release branch +
  PR. Merging the PR auto-tags and triggers the release pipeline.
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

3. **Pull latest**: `git pull origin main`

4. **Quality gates** (abort on any failure):
   - Lint + Format: `bun run lint:fix`
   - Typecheck: `bun run typecheck`
   - Tests: `bun test`
   - Build: `bun run build`

5. **Version bump**:
   - Read current version from `package.json`
   - If `version_bump` provided, use it (patch/minor/major)
   - If not provided, default to `patch`
   - Compute new version (e.g. 1.0.0 → 1.0.1 for patch)
   - Report: `1.0.0 → 1.0.1`

6. **Confirm with user**: Show new version and ask for go/no-go

7. **Create release branch**: `git checkout -b release/v<new_version>`

8. **Update version** in both locations:
   - `package.json` → `"version": "<new_version>"`
   - `src/index.ts` → `.version('<new_version>')`

9. **Commit**: Stage `package.json` and `src/index.ts`, commit `chore: bump version to <new_version>`

10. **Push + open PR**:
    - `git push -u origin release/v<new_version>`
    - Create PR targeting `main` with title `chore: release v<new_version>`
    - PR body: `Bumps version from <old> to <new>. Merging auto-tags and triggers release pipeline.`

11. **Report**:
    - PR URL
    - "Merge the PR → CI auto-tags `v<new_version>` → builds binary → creates GitHub Release → updates Homebrew tap"

## Version Locations

Both must be updated in sync:
- `package.json` → `"version": "x.y.z"`
- `src/index.ts` → `.version('x.y.z')`

## What Happens After Merge

CI handles everything automatically:
1. `auto-tag.yml` detects version change on main → creates `v<version>` tag
2. Tag push triggers `release.yml` → builds binary, creates GitHub Release
3. `release.yml` triggers Homebrew tap formula update

## What This Skill Does NOT Do

- Tag (CI auto-tags on merge)
- Build the release tarball (CI does that)
- Update the Homebrew formula (CI triggers tap repo workflow)
- Publish to npm (this project distributes via Homebrew)

## Dangerous Operations (require explicit user confirmation)

- Version bump confirmation before committing
