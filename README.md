# junior

queue prompts. schedule jobs. claude codes. you sleep.

## what it does

background daemon that picks up tasks, spins up isolated git worktrees, lets Claude Code do the work, and merges results back.

> **Heads up:** Junior runs Claude Code in headless mode with `--dangerously-skip-permissions` and clears the `CLAUDECODE` env var that normally prevents Claude Code from spawning nested instances. That means full autonomy — file writes, shell commands, git operations, and the ability to invoke Claude Code recursively — no human approval prompts. You are responsible for what you point it at.

## install

```bash
git clone https://github.com/JHostalek/junior.git && cd junior
bun install && bun run build
ln -s "$(pwd)/dist/junior" /usr/local/bin/junior
cp .mcp.json.example .mcp.json
# edit .mcp.json to point to your junior-mcp binary path
```

needs [Bun](https://bun.sh) and [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## usage

```bash
cd your-project
junior init    # one-time setup
junior         # open the TUI — everything happens here
```

prefer the CLI? run `junior --help` for the full command reference.

## features

- **fire and forget** — describe a task, walk away. it queues, executes, and merges while you do something else.
  > *"remove redundant comments"*, *"hunt for silent fallbacks and fix them"*
- **nothing breaks** — every task runs in its own git branch. your working tree stays clean.
- **parallel execution** — configurable concurrency. queue 10 things, let them cook at the same time.
- **attach context** — paste images, reference files with `@`, so claude knows exactly what you mean.
  > *"align recent commits with our visual identity @docs/identity.md"*
- **defer work** — postpone tasks for later.
  > *"refactor the auth middleware"* — in 30 minutes
- **scheduled jobs** — cron-based recurring tasks.
  > *"run the test suite and fix anything broken"* — every weekday at 9am
- **hooks** — react to file changes automatically.
  > *"regenerate API docs"* — whenever `src/api/**` changes
- **real-time TUI** — vim-ish keybindings (`j/k`, `dd`, visual mode), live status updates, filter by state.
- **batch operations** — select multiple tasks, cancel/retry/delete them all at once.

## license

MIT
