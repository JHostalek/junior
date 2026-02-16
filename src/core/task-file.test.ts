import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { TaskFileError } from './errors.js';
import { parseTaskFile, taskFileSchema } from './task-file.js';

describe('taskFileSchema', () => {
  test('accepts valid task file with required fields', () => {
    const result = taskFileSchema.safeParse({
      title: 'My Task',
      repo: '/path/to/repo',
      prompt: 'Do something',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Task');
      expect(result.data.repo).toBe('/path/to/repo');
      expect(result.data.prompt).toBe('Do something');
      expect(result.data.base_branch).toBeUndefined();
    }
  });

  test('rejects missing title', () => {
    const result = taskFileSchema.safeParse({
      repo: '/path/to/repo',
      prompt: 'Do something',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('title');
    }
  });

  test('accepts valid task file with base_branch', () => {
    const result = taskFileSchema.safeParse({
      title: 'My Task',
      repo: '/path/to/repo',
      prompt: 'Do something',
      base_branch: 'develop',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base_branch).toBe('develop');
    }
  });

  test('allows multiline prompt', () => {
    const result = taskFileSchema.safeParse({
      title: 'My Task',
      repo: '/path/to/repo',
      prompt: 'Line 1\nLine 2\nLine 3',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toContain('\n');
    }
  });
});

describe('parseTaskFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'junior-task-file-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws TaskFileError when file not found', async () => {
    const nonexistent = path.join(tmpDir, 'nonexistent.yaml');
    await expect(parseTaskFile(nonexistent)).rejects.toThrow(TaskFileError);
  });

  test('throws TaskFileError for invalid YAML', async () => {
    const filePath = path.join(tmpDir, 'invalid.yaml');
    fs.writeFileSync(filePath, '{{{invalid');
    await expect(parseTaskFile(filePath)).rejects.toThrow(TaskFileError);
  });

  test('parses valid task file', async () => {
    const fakeRepo = path.join(tmpDir, 'repo');
    fs.mkdirSync(fakeRepo);
    fs.mkdirSync(path.join(fakeRepo, '.git'));

    const filePath = path.join(tmpDir, 'task.yaml');
    fs.writeFileSync(filePath, YAML.stringify({ title: 'Test Task', repo: fakeRepo, prompt: 'Do something' }));

    const result = await parseTaskFile(filePath);
    expect(result.title).toBe('Test Task');
    expect(result.repo).toBe(fakeRepo);
    expect(result.prompt).toBe('Do something');
  });

  test('throws TaskFileError when repo has no .git directory', async () => {
    const fakeRepo = path.join(tmpDir, 'not-a-repo');
    fs.mkdirSync(fakeRepo);

    const filePath = path.join(tmpDir, 'task.yaml');
    fs.writeFileSync(filePath, YAML.stringify({ title: 'Test Task', repo: fakeRepo, prompt: 'Do something' }));

    await expect(parseTaskFile(filePath)).rejects.toThrow(TaskFileError);
  });

  test('throws TaskFileError for schema validation failure', async () => {
    const filePath = path.join(tmpDir, 'bad-schema.yaml');
    fs.writeFileSync(filePath, YAML.stringify({ title: 'Missing fields' }));
    await expect(parseTaskFile(filePath)).rejects.toThrow(TaskFileError);
  });
});
