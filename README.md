# Junior

[![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude-d97706.svg)](https://docs.anthropic.com/en/docs/claude-code)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Built with Bun](https://img.shields.io/badge/Built_with-Bun-f9f1e1.svg)](https://bun.sh)
[![React + Ink](https://img.shields.io/badge/TUI-React_+_Ink-61dafb.svg)](https://github.com/vadimdemedes/ink)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

queue prompts. schedule jobs. claude codes. you sleep.

## what it does

background daemon that picks up tasks, spins up isolated git worktrees, lets Claude Code do the work, and merges results back.

> **Heads up:** Junior runs Claude Code in headless mode with `--dangerously-skip-permissions`. That means full autonomy — file writes, shell commands, git operations — no human approval prompts. You are responsible for what you point it at.

## install

```bash
git clone https://github.com/JHostalek/junior.git && cd junior
bun install && bun run build
ln -s "$(pwd)/dist/junior" /usr/local/bin/junior
```

needs [Bun](https://bun.sh) and [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## usage

```bash
cd your-project
junior init    # one-time setup
junior         # open the TUI — everything happens here
```

prefer the CLI? run `junior --help` for the full command reference.

## how it works

- **fire and forget** — describe a task, walk away. it queues, executes, and merges while you do something else.
- **nothing breaks** — every task runs in its own git branch. your working tree stays clean.
- **parallel execution** — configurable concurrency. queue 10 things, let them cook at the same time.
- **scheduled jobs** — cron-based recurring tasks. say "every weekday at 9am" and it figures out the cron for you.
- **attach context** — paste images, reference files with `@`, so claude knows exactly what you mean.
- **real-time TUI** — vim-ish keybindings (`j/k`, `dd`, visual mode), live status updates, filter by state.
- **batch operations** — select multiple tasks, cancel/retry/delete them all at once.

## license

MIT
