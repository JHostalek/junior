# contributing

## setup

```bash
git clone https://github.com/JHostalek/junior.git && cd junior
bun install
```

## workflow

```bash
bun run dev          # run in development mode
bun run check        # typecheck + lint
bun run test         # run tests
bun run build        # compile to binary — always run before submitting
```

## conventions

code style and architecture rules live in `CLAUDE.md`. the short version:

- strict TypeScript, ESM, explicit `.js` extensions
- `@/*` for cross-directory imports, `./` for same-directory
- `Bun.spawn()` for all process/git operations (never shell strings)
- `JuniorError` subclasses for errors, Zod schemas for validation
- no comments unless they explain *why*, not *what*

## submitting changes

1. fork and branch from `main`
2. follow the conventions above
3. `bun run check && bun run test && bun run build` — all green
4. open a PR with a clear description of what and why

## reporting issues

include: junior version, bun version, OS, steps to reproduce, and relevant logs from `.junior/logs/`.
