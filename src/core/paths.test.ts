import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDirectories, resolvePath } from './paths.js';

describe('ensureDirectories', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'junior-paths-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates all required directories', () => {
    ensureDirectories();
    expect(fs.existsSync(path.join(tmpDir, '.junior'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'logs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'worktrees'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'attachments'))).toBe(true);
  });

  test('is idempotent', () => {
    ensureDirectories();
    ensureDirectories();
    expect(fs.existsSync(path.join(tmpDir, '.junior'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'logs'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'worktrees'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'attachments'))).toBe(true);
  });
});

describe('resolvePath', () => {
  test('expands tilde to home directory', () => {
    const result = resolvePath('~/some/path');
    expect(result).toBe(path.join(os.homedir(), 'some/path'));
  });

  test('resolves relative path to absolute', () => {
    const result = resolvePath('relative/path');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toBe(path.resolve('relative/path'));
  });

  test('keeps absolute path as-is', () => {
    const result = resolvePath('/absolute/path');
    expect(result).toBe('/absolute/path');
  });
});
