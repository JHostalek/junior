---
root: false
description: "Project-specific architecture, conventions, testing, linting, and gotchas"
targets: ["*"]
---

# Junior — Project Conventions

Autonomous software development CLI that queues tasks and executes them via headless Claude Code in git worktrees.

## Stack

- TypeScript (strict), Bun runtime, ESM
- CLI: Commander.js
- DB: SQLite via Drizzle ORM + bun:sqlite (WAL mode)
- TUI: React + Ink
- Validation: Zod
- Config/task files: YAML
- Scheduling: Croner (cron expressions)
- Build: `bun build --compile` (single native binary)

## Architecture

```
src/
├── index.ts          # CLI entry, Commander setup
├── cli/              # Subcommands: task, daemon, schedule, config
├── core/             # Utilities: git ops, config, claude spawning, logging, errors, paths, events
├── daemon/           # Background service: executor, poll loop, scheduler, recovery
├── tui/              # Terminal UI: React + Ink components
└── db/               # Drizzle schema, migrations, db init
```

**Runtime data** lives in `.junior/` within the target repo:
- `config.yaml` — user config (max_concurrency default: 2)
- `junior.db` — SQLite database
- `logs/` — per-job execution logs
- `worktrees/` — git worktrees for isolated execution
- `events` — change notification file (daemon writes, TUI watches)

**Job execution flow**: create worktree → symlink gitignored files → spawn Claude Code (`--output-format stream-json`) → capture result → remove symlinks → merge branch into base (`--no-ff`) → remove worktree → delete branch.

**TUI updates**: daemon writes to `.junior/events` on state changes. TUI watches this file with `fs.watch()` and re-queries DB. 10s fallback poll for daemon status changes.

## Conventions

- IMPORTANT: Always run `bun run build` after completing a task
- IMPORTANT: No comments in code unless explicitly requested
- Error hierarchy: `JuniorError` base class with typed subclasses (`TaskFileError`, `ConfigError`, `DaemonError`, `GitError`, `ClaudeError`)
- All process spawning uses `Bun.spawn()` (never node:child_process)
- All git operations use `Bun.spawn()` with array args (never shell strings)
- Structured JSON logging to stderr: `[ISO_TIMESTAMP] [LEVEL] message {metadata}`
- Database columns use `snake_case`, TypeScript properties use `camelCase`
- Cross-directory imports use `@/*` path aliases (e.g. `@/core/paths.js`); same-directory imports use `./`
- All imports use explicit `.js` extensions (ESM requirement)
- Environment variables are centralized in `core/flags.ts` (`Flag` namespace)
- DB schema changes go through `db/migrations.ts` (embedded SQL, binary-compatible)
- Use existing Zod schemas for validation — do not add ad-hoc validation
- Daemon uses signal handlers (SIGTERM/SIGINT) for graceful shutdown
- Call `notifyChange()` from `core/events.ts` after any DB state mutation in the daemon

## Testing

- Test runner: Bun built-in (`bun test`), Jest-compatible API
- Test files co-located with source: `src/core/foo.test.ts` next to `src/core/foo.ts`
- Use `bun:test` imports (`describe`, `test`, `expect`, `spyOn`, `mock`, `beforeEach`, `afterEach`)
- Same-directory imports in tests use `./` with `.js` extension (e.g. `import { foo } from './bar.js'`)

## Linting

- Linter: Biome (Rust-based, combines linting + formatting)
- Config: `biome.json` — recommended rules, single quotes, semicolons, 2-space indent, 120 line width
- Run `bun run lint:fix` to auto-fix; `bun run check` for typecheck + lint together

## Developer Worktree Workflow

Human-initiated feature work uses `/tmp/` worktrees (ephemeral, auto-cleaned on reboot):
- `/worktree feature/foo` → creates `/tmp/{repo}-feature-foo` with branch `feature/foo`
- Work + commit with `/git`
- `/pr` → push + create PR
- Switch back to main repo
- `/worktree-clean /tmp/{repo}-feature-foo` → remove worktree + delete branch

**Distinction**: `.junior/worktrees/` is for the daemon's automated job execution. `/tmp/` worktrees are for interactive developer sessions.

## Gotchas

- The `.junior/` directory is per-repo (cwd-relative), not global — `drizzle.config.ts` also uses `cwd/.junior/junior.db`
- Worktree symlinks include `node_modules`, `.env`, `.claude/` — these must not be committed
- Job retries: max 2 attempts with 60s backoff — do not change without discussion
- SQLite WAL mode is required for daemon concurrency — never switch to default journal mode
- Worktree must be removed AFTER merging into base — the branch's merge commit lives in the worktree, removing it first destroys the commit
- `bun build --compile` produces a self-contained binary — `process.execPath` points to the binary itself
