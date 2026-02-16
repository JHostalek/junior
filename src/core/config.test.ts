import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { ZodError } from 'zod';
import { configSchema, DEFAULT_CONFIG, formatZodErrors, loadConfig } from './config.js';
import { ConfigError } from './errors.js';

describe('formatZodErrors', () => {
  test('formats a single issue', () => {
    const error = new ZodError([
      {
        code: 'invalid_type',
        expected: 'number',
        received: 'string',
        path: ['max_concurrency'],
        message: 'Expected number, received string',
      },
    ]);
    expect(formatZodErrors(error)).toBe('max_concurrency: Expected number, received string');
  });

  test('formats multiple issues separated by semicolons', () => {
    const error = new ZodError([
      {
        code: 'invalid_type',
        expected: 'number',
        received: 'string',
        path: ['max_concurrency'],
        message: 'Expected number, received string',
      },
      {
        code: 'invalid_enum_value',
        options: ['ask', 'stop', 'keep'],
        received: 'invalid',
        path: ['on_exit'],
        message: "Invalid enum value. Expected 'ask' | 'stop' | 'keep', received 'invalid'",
      },
    ]);
    const result = formatZodErrors(error);
    expect(result).toContain('max_concurrency: Expected number, received string');
    expect(result).toContain('; ');
    expect(result).toContain('on_exit:');
  });

  test('formats nested path with dot notation', () => {
    const error = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['deeply', 'nested', 'field'],
        message: 'Expected string, received number',
      },
    ]);
    expect(formatZodErrors(error)).toBe('deeply.nested.field: Expected string, received number');
  });

  test('formats issue with empty path', () => {
    const error = new ZodError([
      {
        code: 'invalid_type',
        expected: 'object',
        received: 'string',
        path: [],
        message: 'Expected object, received string',
      },
    ]);
    expect(formatZodErrors(error)).toBe(': Expected object, received string');
  });

  test('handles empty error array', () => {
    const error = new ZodError([]);
    expect(formatZodErrors(error)).toBe('');
  });
});

describe('configSchema', () => {
  test('accepts valid config with all fields', () => {
    const result = configSchema.safeParse({ max_concurrency: 4, on_exit: 'stop' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_concurrency).toBe(4);
      expect(result.data.on_exit).toBe('stop');
    }
  });

  test('accepts max_concurrency of 1', () => {
    const result = configSchema.safeParse({ max_concurrency: 1, on_exit: 'ask' });
    expect(result.success).toBe(true);
  });

  test('accepts max_concurrency of 16', () => {
    const result = configSchema.safeParse({ max_concurrency: 16, on_exit: 'keep' });
    expect(result.success).toBe(true);
  });

  test('rejects invalid on_exit value', () => {
    const result = configSchema.safeParse({ max_concurrency: 2, on_exit: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('DEFAULT_CONFIG', () => {
  test('passes schema validation', () => {
    const result = configSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });
});

describe('loadConfig', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'junior-config-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns defaults when no config file exists', () => {
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test('partial config merges with defaults', () => {
    fs.mkdirSync(path.join(tmpDir, '.junior'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.junior', 'config.yaml'), YAML.stringify({ max_concurrency: 4 }));
    const config = loadConfig();
    expect(config.max_concurrency).toBe(4);
    expect(config.on_exit).toBe('ask');
  });

  test('invalid config throws ConfigError', () => {
    fs.mkdirSync(path.join(tmpDir, '.junior'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.junior', 'config.yaml'), YAML.stringify({ max_concurrency: 999 }));
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  test('valid file loads correctly', () => {
    fs.mkdirSync(path.join(tmpDir, '.junior'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.junior', 'config.yaml'),
      YAML.stringify({ max_concurrency: 8, on_exit: 'stop' }),
    );
    const config = loadConfig();
    expect(config.max_concurrency).toBe(8);
    expect(config.on_exit).toBe('stop');
  });
});
