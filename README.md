# junior

queue prompts. schedule jobs. claude codes. you sleep.

## what it does

background daemon that picks up tasks, spins up isolated git worktrees, lets Claude Code do the work, and merges results back. you describe what needs to happen — junior handles when and how.

the key insight: **junior runs your Claude Code instance.** every MCP server you've connected, every tool claude can reach — notifications, calendars, Slack, databases, deployments — junior can use them too. unattended.

> **Heads up:** Junior runs Claude Code in headless mode with `--dangerously-skip-permissions` and clears the `CLAUDECODE` env var that normally prevents Claude Code from spawning nested instances. That means full autonomy — file writes, shell commands, git operations, and the ability to invoke Claude Code recursively — no human approval prompts. You are responsible for what you point it at.

## features

### fire and forget

describe a task in plain english. junior queues it, executes it in an isolated branch, and merges the result. you don't babysit.

> *"remove all `console.log` statements and replace with structured logging"*
>
> *"add input validation to every public API endpoint using zod"*
>
> *"generate unit tests for `src/core/` — aim for edge cases, not coverage theater"*

queue 10 tasks at once. they run in parallel across isolated worktrees. nothing conflicts. your working tree stays clean.

### schedules — the cron you always wanted

recurring tasks described in plain english. junior translates them to cron expressions.

> *"run the full test suite every weekday at 9am. if anything fails, fix it."*
>
> *"every monday morning, summarize last week's commits into a changelog draft"*
>
> *"check for outdated dependencies every sunday and open PRs for safe upgrades"*

think about what you'd do if you had a junior dev who never forgot, never got bored, and worked weekends:

- **daily standup digest** — summarize yesterday's commits, open PRs, and failing tests. send a notification.
- **continuous documentation** — regenerate API docs from source every night. no drift.
- **security sweeps** — scan for hardcoded secrets, vulnerable patterns, or OWASP issues on a schedule.
- **style enforcement** — lint and auto-fix code style across the entire repo. nightly.

### hooks — react to what happens

hooks watch for conditions and trigger tasks automatically when something changes.

> *"whenever `src/api/**` changes, regenerate the OpenAPI spec and update client types"*
>
> *"when a new branch matching `release/*` is created, run the full integration test suite"*
>
> *"if `package.json` changes, verify lockfile integrity and check for known vulnerabilities"*

hooks turn junior from a task runner into an event-driven system:

- **auto-review** — when a PR branch appears, run a code review and post findings.
- **deploy gate** — when `main` gets new commits, run smoke tests before the deploy pipeline.
- **schema sync** — when DB migrations change, regenerate TypeScript types and API schemas.

### it goes further than code

junior inherits everything your Claude Code session can do. if you've connected MCP servers for Slack, email, Linear, Notion, GitHub, or anything else — junior can use them in tasks, schedules, and hooks.

> *"every morning at 9am, summarize overnight commits and post to #engineering in Slack"*
>
> *"when CI fails on main, create a Linear ticket with the error details and assign it to on-call"*
>
> *"after every successful deploy, update the release notes in Notion"*

this is not a feature we built. it's a consequence of running your Claude Code. whatever tools you give claude, junior gets for free.

### self-organizing

with the [MCP server](#mcp-server), the executing agent can create follow-up tasks, set schedules, and register hooks mid-run. one prompt bootstraps entire workflows.

> *"set up CI monitoring for this repo"* — the agent creates a schedule to run tests daily, a hook to catch failures, and a follow-up task template for fixes. from one sentence.

### TUI + batch ops

real-time terminal UI with vim keybindings (`j/k`, `dd`, visual mode). live status, filter by state, select multiple tasks and cancel/retry/delete in bulk. or use the CLI — `junior --help` for everything.

## install

```bash
brew tap jhostalek/tap && brew install junior
```

needs [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## usage

```bash
cd your-project
junior init    # one-time setup
junior         # open the TUI — everything happens here
```

prefer the CLI? run `junior --help` for the full command reference.

## mcp server

**you want this.** without it the worker agent is blind — it can edit files and run commands, but can't see the task queue, create follow-ups, set schedules, or register hooks. with it, junior actually works as designed.

> *"run tests every morning at 9am"* — the agent creates the schedule itself instead of writing a note about it.

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
