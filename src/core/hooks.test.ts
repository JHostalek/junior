import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createHookContext, evaluateHook } from './hooks.js';

mock.module('./logger.js', () => ({
  warn: () => {},
  info: () => {},
  error: () => {},
  debug: () => {},
  log: () => {},
}));

mock.module('./constants.js', () => ({
  HOOK_EVAL_TIMEOUT_MS: 200,
}));

const ctx = createHookContext('/tmp', {});

describe('evaluateHook', () => {
  test('returns true when check function returns truthy', async () => {
    const result = await evaluateHook('return true;', ctx);
    expect(result).toBe(true);
  });

  test('returns false when check function returns falsy', async () => {
    const result = await evaluateHook('return false;', ctx);
    expect(result).toBe(false);
  });

  test('returns false when check function throws', async () => {
    const result = await evaluateHook('throw new Error("boom");', ctx);
    expect(result).toBe(false);
  });

  test('returns false when check function exceeds timeout', async () => {
    const result = await evaluateHook('await new Promise(r => setTimeout(r, 5000)); return true;', ctx);
    expect(result).toBe(false);
  });
});
