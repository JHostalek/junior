import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateHook, shutdownHookWorker } from './hooks.js';

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

function evalHook(checkFn: string, state: Record<string, unknown> = {}, allowedCommands?: string[]) {
  return evaluateHook({ checkFn, repoPath, state, allowedCommands });
}

afterAll(() => {
  shutdownHookWorker();
});

describe('evaluateHook', () => {
  test('returns triggered=true when check function returns truthy', async () => {
    const result = await evalHook('return true;');
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('returns triggered=false when check function returns falsy', async () => {
    const result = await evalHook('return false;');
    expect(result.triggered).toBe(false);
    expect(result.error).toBeUndefined();
  });

  test('captures error when check function throws', async () => {
    const result = await evalHook('throw new Error("boom");');
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('boom');
  });

  test('returns error on timeout', async () => {
    const result = await evalHook('await new Promise(r => setTimeout(r, 10000)); return true;');
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('Timed out');
  });

  test('preserves state mutations across eval', async () => {
    const result = await evalHook('ctx.state.counter += 1; return false;', { counter: 1 });
    expect(result.triggered).toBe(false);
    expect(result.state.counter).toBe(2);
    expect(result.error).toBeUndefined();
  });

  test('allows read-only git commands', async () => {
    const result = await evalHook('await ctx.git("rev-parse", "--git-dir"); return true;');
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('blocks disallowed git subcommands', async () => {
    const result = await evalHook('await ctx.git("push", "origin", "main"); return true;');
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  test('blocks readFile path traversal', async () => {
    const result = await evalHook('await ctx.readFile("../../etc/passwd"); return true;');
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('readFile');
  });

  test('captures syntax errors', async () => {
    const result = await evalHook('return {{invalid;');
    expect(result.triggered).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('exec works when no allowlist configured', async () => {
    const result = await evalHook('const out = await ctx.exec("echo", ["hello"]); return out === "hello";');
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('exec allows commands on the allowlist', async () => {
    const result = await evalHook('const out = await ctx.exec("echo", ["hello"]); return out === "hello";', {}, [
      'echo',
    ]);
    expect(result.triggered).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('exec blocks commands not on the allowlist', async () => {
    const result = await evalHook('await ctx.exec("echo", ["hello"]); return true;', {}, ['curl']);
    expect(result.triggered).toBe(false);
    expect(result.error).toContain('not allowed');
    expect(result.error).toContain('curl');
  });

  describe('symlink traversal', () => {
    let tmpDir: string;
    let symlinkPath: string;

    beforeAll(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-symlink-test-'));
      const secretFile = path.join(tmpDir, 'secret.txt');
      fs.writeFileSync(secretFile, 'secret-data');
      symlinkPath = path.join(repoPath, '.test-symlink-outside');
      try {
        fs.unlinkSync(symlinkPath);
      } catch {}
      fs.symlinkSync(secretFile, symlinkPath);
    });

    afterAll(() => {
      try {
        fs.unlinkSync(symlinkPath);
      } catch {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('blocks readFile via symlink pointing outside repo', async () => {
      const result = await evalHook('await ctx.readFile(".test-symlink-outside"); return true;');
      expect(result.triggered).toBe(false);
      expect(result.error).toContain('outside repo');
    });
  });
});
