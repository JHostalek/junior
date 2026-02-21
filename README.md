# junior

queue prompts. schedule jobs. claude codes. you sleep.

## what it does

background daemon for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). tasks run in isolated git worktrees and merge back automatically. it runs your Claude Code with all your MCP servers, so anything claude can reach — Slack, Linear, Notion, databases — junior can use unattended.

> **Heads up:** Junior runs Claude Code in headless mode with `--dangerously-skip-permissions` and clears the `CLAUDECODE` env var that normally prevents Claude Code from spawning nested instances. That means full autonomy — file writes, shell commands, git operations, and the ability to invoke Claude Code recursively — no human approval prompts. You are responsible for what you point it at.

## features

**fire and forget** — describe a task, walk away. parallel execution, isolated branches.

> *"add input validation to every public API endpoint using zod"*
>
> *"generate unit tests for `src/core/` — aim for edge cases, not coverage theater"*

**schedules** — recurring tasks on a cron.

> *"run the full test suite every weekday at 9am. if anything fails, fix it."*
>
> *"every monday morning, summarize last week's commits into a changelog draft"*
>
> *"check for outdated dependencies every sunday and open PRs for safe upgrades"*
>
> *"every night, regenerate API docs from source"*

**hooks** — trigger tasks when conditions change.

> *"whenever `src/api/**` changes, regenerate the OpenAPI spec and update client types"*
>
> *"when a new branch matching `release/*` appears, review the diff and generate release notes"*
>
> *"if `package.json` changes, verify lockfile integrity and check for known vulnerabilities"*

**context** — paste images from clipboard, reference files with `@`.

**self-organizing** — with the [MCP server](#mcp-server), the agent creates follow-up tasks, schedules, and hooks mid-run.

> *"set up CI monitoring for this repo"* — agent creates a daily test schedule, a hook to catch failures, and a follow-up task for fixes. from one prompt.

**TUI** — visual multi-select, bulk operations, filter by state. or use the CLI.

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

**you want this.** gives the worker agent access to the task queue, schedules, and hooks. without it, junior can't self-organize.

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
