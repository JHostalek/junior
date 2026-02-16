# Contributing to Junior

Thank you for your interest in contributing to Junior. This document provides guidelines for development and submitting changes.

## Development Setup

### Prerequisites

- Bun runtime (latest version)
- Git
- TypeScript knowledge

### Getting Started

Clone the repository:

```bash
git clone https://github.com/JHostalek/junior.git
cd junior
```

Install dependencies:

```bash
bun install
```

Run in development mode:

```bash
bun run dev
```

Build the binary:

```bash
bun run build
```

Run type checking:

```bash
bun run typecheck
```

Run linting:

```bash
bun run lint
bun run lint:fix    # auto-fix issues
```

Run tests:

```bash
bun run test
```

Run all checks (typecheck + lint):

```bash
bun run check
```

## Code Conventions

Junior follows strict conventions documented in `CLAUDE.md`. Key points:

### Code Style

- TypeScript strict mode, ESM modules
- All imports use explicit `.js` extensions
- Cross-directory imports use `@/*` path aliases, same-directory imports use `./`
- Database columns use `snake_case`, TypeScript properties use `camelCase`
- No comments in code unless explicitly necessary for clarity

### Architecture

- Process spawning uses `Bun.spawn()` exclusively (never node:child_process)
- Git operations use `Bun.spawn()` with array args (never shell strings)
- Structured JSON logging to stderr: `[ISO_TIMESTAMP] [LEVEL] message {metadata}`
- Error hierarchy based on `JuniorError` class with typed subclasses
- Database schema changes through `db/migrations.ts`

### Best Practices

- Use existing Zod schemas for validation
- Call `notifyChange()` from `core/events.ts` after daemon DB state mutations
- Environment variables centralized in `core/flags.ts`
- Always run `bun run build` after completing changes

## Project Structure

```
src/
├── index.ts          # CLI entry, Commander setup
├── cli/              # Subcommands: task, daemon, schedule, config
├── core/             # Utilities: git ops, config, claude spawning, logging, errors, paths, events
├── daemon/           # Background service: executor, poll loop, scheduler, recovery
├── tui/              # Terminal UI: React + Ink components
└── db/               # Drizzle schema, migrations, db init
```

Runtime data lives in `.junior/` within the target repository.

## Testing

Tests use Bun's built-in test runner. Run them with `bun run test` or `bun run test:watch` for watch mode.

## Linting

The project uses [Biome](https://biomejs.dev/) for linting and formatting. Run `bun run lint` to check and `bun run lint:fix` to auto-fix issues.

## Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the conventions above
4. Run `bun run check` to ensure type safety and lint passes
5. Run `bun run test` to verify tests pass
6. Run `bun run build` to verify the binary compiles
7. Commit your changes with clear, descriptive messages
8. Push to your fork and submit a pull request

### Pull Request Guidelines

- Clearly describe what your PR does and why
- Reference any related issues
- Ensure all checks pass (`bun run check && bun run test && bun run build`)
- Keep changes focused and atomic
- Update documentation if adding new features

## Reporting Issues

When reporting bugs, include:

- Junior version
- Bun version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs from `.junior/logs/`

For feature requests, describe:

- The problem you're trying to solve
- How you envision the feature working
- Any alternatives you've considered

## Questions?

Open an issue for questions or clarifications about development.
