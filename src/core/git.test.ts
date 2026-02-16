import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { GitError } from './errors.js';
import { generateBranchName, generateScheduledBranchName, validateBranchName } from './git.js';

describe('generateBranchName', () => {
  test('creates branch name from simple title and jobId', () => {
    expect(generateBranchName('fix login bug', 42)).toBe('junior/fix-login-bug-42');
  });

  test('converts title to lowercase', () => {
    expect(generateBranchName('Fix LOGIN Bug', 1)).toBe('junior/fix-login-bug-1');
  });

  test('replaces non-alphanumeric characters with hyphens', () => {
    expect(generateBranchName('fix: the @#$ bug!', 5)).toBe('junior/fix-the-bug-5');
  });

  test('handles empty title', () => {
    expect(generateBranchName('', 1)).toBe('junior/-1');
  });

  test('handles title with numbers', () => {
    expect(generateBranchName('task 123 update', 5)).toBe('junior/task-123-update-5');
  });
});

describe('generateScheduledBranchName', () => {
  let dateSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    dateSpy = spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-15T10:30:45.123Z');
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  test('creates branch name with timestamp suffix', () => {
    expect(generateScheduledBranchName('daily sync')).toBe('junior/daily-sync-20260215103045');
  });

  test('timestamp format is YYYYMMDDHHMMSS (14 chars)', () => {
    const result = generateScheduledBranchName('test');
    const ts = result.split('-').pop()!;
    expect(ts).toBe('20260215103045');
    expect(ts.length).toBe(14);
  });

  test('handles different timestamps', () => {
    dateSpy.mockRestore();
    dateSpy = spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-12-31T23:59:59.999Z');
    expect(generateScheduledBranchName('midnight')).toBe('junior/midnight-20251231235959');
  });
});

describe('validateBranchName', () => {
  test('valid name passes', () => {
    expect(() => validateBranchName('feature/my-branch')).not.toThrow();
  });

  test('empty string throws GitError', () => {
    expect(() => validateBranchName('')).toThrow(GitError);
  });

  test('starts with hyphen throws GitError', () => {
    expect(() => validateBranchName('-bad-name')).toThrow(GitError);
  });

  test('contains space throws GitError', () => {
    expect(() => validateBranchName('bad name')).toThrow(GitError);
  });

  test('contains double dots throws GitError', () => {
    expect(() => validateBranchName('bad..name')).toThrow(GitError);
  });

  test('contains tilde throws GitError', () => {
    expect(() => validateBranchName('bad~name')).toThrow(GitError);
  });

  test('contains null byte throws GitError', () => {
    expect(() => validateBranchName('bad\x00name')).toThrow(GitError);
  });
});
