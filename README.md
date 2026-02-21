# junior

queue prompts. schedule jobs. claude codes. you sleep.

## what it does

background daemon for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). you describe tasks — junior queues them, runs each in an isolated git worktree, and merges results back. it runs your Claude Code with all your MCP servers, so anything claude can reach — Slack, Linear, Notion, calendars, databases — junior can use unattended.

> **Heads up:** Junior runs Claude Code in headless mode with `--dangerously-skip-permissions` and clears the `CLAUDECODE` env var that normally prevents Claude Code from spawning nested instances. That means full autonomy — file writes, shell commands, git operations, and the ability to invoke Claude Code recursively — no human approval prompts. You are responsible for what you point it at.

## features

**fire and forget** — describe it, walk away. isolated branch, auto-merge. queue 10 at once, they run in parallel.

> *"add input validation to every public API endpoint using zod"*
>
> *"generate unit tests for `src/core/` — aim for edge cases, not coverage theater"*

**schedules** — recurring tasks in plain english. junior translates to cron.

> *"run the full test suite every weekday at 9am. if anything fails, fix it."*
>
> *"every monday morning, summarize last week's commits into a changelog draft"*
>
> *"check for outdated dependencies every sunday and open PRs for safe upgrades"*

a few more ideas: nightly security sweeps. daily standup digests sent as notifications. continuous API doc regeneration. scheduled lint enforcement across the entire repo.

**hooks** — trigger tasks when conditions are met. checks run on a polling interval.

> *"whenever `src/api/**` changes, regenerate the OpenAPI spec and update client types"*
>
> *"when a new branch matching `release/*` appears, review the diff and generate release notes"*
>
> *"if `package.json` changes, verify lockfile integrity and check for known vulnerabilities"*

more: auto-review when PR branches appear. deploy gates that run smoke tests when `main` gets new commits. schema sync when migrations change.

**context** — paste images from clipboard, reference files with `@`. claude sees what you mean.

**self-organizing** — with the [MCP server](#mcp-server), the executing agent creates follow-up tasks, sets schedules, and registers hooks mid-run. one prompt bootstraps entire workflows.

> *"set up CI monitoring for this repo"* — agent creates a daily test schedule, a hook to catch failures, and a follow-up task template for fixes. one sentence.

**TUI** — real-time terminal UI. visual multi-select, bulk cancel/retry/delete, filter by state. or use the CLI.

## install

```bash
brew tap jhostalek/tap && brew install junior
```

## usage

```bash
cd your-project
junior init    # one-time setup
junior         # open the TUI
```

`junior --help` for the full command reference.

## mcp server

**you want this.** without it the worker agent can edit files and run commands, but can't see the task queue, create follow-ups, set schedules, or register hooks. with it, junior works as designed.

add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "junior": {
      "command": "npx",
      "args": ["-y", "@jhostalek/junior-mcp"]
    }
  }
}
```

## license

MIT
