# junior

queue prompts. schedule jobs. claude codes. you sleep.

<img src="demo/demo.gif" alt="Junior TUI demo" width="800" />

## what it does

background daemon for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CC). tasks run in isolated git worktrees and merge back automatically. it runs your CC with all your MCP servers, so anything claude can reach — Slack, Linear, Notion, databases — junior can use unattended.

> **Heads up:** Junior runs CC in headless mode with `--dangerously-skip-permissions` and clears the `CLAUDECODE` env var that normally prevents CC from spawning nested instances. That means full autonomy — file writes, shell commands, git operations, and the ability to invoke CC recursively — no human approval prompts. You are responsible for what you point it at.

## features

**fire and forget** — describe a task, walk away. parallel execution, isolated branches.

> *"add input validation to every public API endpoint using zod"*
>
> *"generate unit tests for `src/core/` — aim for edge cases, not coverage theater"*

**schedules** — recurring tasks on a cron.

> *"every weekday at 9am, review open Sentry issues and fix anything with a clear stack trace"*
>
> *"every monday morning, post a summary of last week's merged PRs to #engineering in Slack"*
>
> *"every sunday, check for outdated dependencies and open PRs for safe upgrades"*
>
> *"every night, query Grafana for error rate spikes and create Linear tickets for new anomalies"*

**hooks** — trigger tasks when conditions change.

> *"whenever `src/api/**` changes, regenerate the OpenAPI spec and update client types"*
>
> *"when a new branch matching `release/*` appears, review the diff and generate release notes"*
>
> *"if `package.json` changes, verify lockfile integrity and check for known vulnerabilities"*

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

**you want this.** the [`junior-mcp`](https://github.com/JHostalek/junior-mcp) server gives the worker agent access to the task queue, schedules, and hooks — so it can create follow-ups, set recurring jobs, and register hooks mid-run.

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
