import { describe, expect, mock, test } from 'bun:test';
import { evaluateHook } from './hooks.js';

mock.module('./logger.js', () => ({
  warn: () => {},
  info: () => {},
  error: () => {},
  debug: () => {},
  log: () => {},
}));

mock.module('./constants.js', () => ({
  HOOK_EVAL_TIMEOUT_MS: 2000,
}));

const repoPath = import.meta.dir;
const emptyState = {};

describe('evaluateHook', () => {
  test('returns triggered=true when check function returns truthy', async () => {
    const result = await evaluateHook('return true;', repoPath, { ...emptyState });
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns triggered=false when check function returns falsy', async () => {
    const result = await evaluateHook('return false;', repoPath, { ...emptyState });
    expect(result.triggered).toBe(false);
    expect(result.error).toBeUndefined();
  });

  test('captures error when check function throws', async () => {
    const result = await evaluateHook('throw new Error("boom");', repoPath, { ...emptyState });
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('boom');
  });

  test('returns error on timeout', async () => {
    const result = await evaluateHook('await new Promise(r => setTimeout(r, 10000)); return true;', repoPath, {
      ...emptyState,
    });
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('Timed out');
  });

  test('preserves state mutations across eval', async () => {
    const state = { counter: 1 };
    const result = await evaluateHook('ctx.state.counter += 1; return false;', repoPath, state);
    expect(result.triggered).toBe(false);
    expect(result.state.counter).toBe(2);
    expect(result.error).toBeUndefined();
  });

  test('allows read-only git commands', async () => {
    const result = await evaluateHook('await ctx.git("rev-parse", "--git-dir"); return true;', repoPath, {
      ...emptyState,
    });
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('blocks disallowed git subcommands', async () => {
    const result = await evaluateHook('await ctx.git("push", "origin", "main"); return true;', repoPath, {
      ...emptyState,
    });
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  test('blocks readFile path traversal', async () => {
    const result = await evaluateHook('await ctx.readFile("../../etc/passwd"); return true;', repoPath, {
      ...emptyState,
    });
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('outside repo');
  });

  test('captures error when ctx.exec is used', async () => {
    const result = await evaluateHook('await ctx.exec("ls", ["-la"]); return true;', repoPath, { ...emptyState });
    expect(result.triggered).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('captures syntax errors', async () => {
    const result = await evaluateHook('return {{invalid;', repoPath, { ...emptyState });
    expect(result.triggered).toBe(false);
    expect(result.error).toBeDefined();
  });
});
