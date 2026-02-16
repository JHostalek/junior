import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDaemonRunning, isProcessRunning, writePidFile } from './pid.js';

let originalCwd: string;
let tmpDir: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pid-test-'));
  process.chdir(tmpDir);
  fs.mkdirSync(path.join(tmpDir, '.junior'), { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('isProcessRunning', () => {
  test('returns true for current process PID', () => {
    expect(isProcessRunning(process.pid)).toBe(true);
  });

  test('returns false for non-existent PID', () => {
    expect(isProcessRunning(99999)).toBe(false);
  });
});

describe('isDaemonRunning', () => {
  test('returns not running when no PID file exists', () => {
    expect(isDaemonRunning()).toEqual({ running: false, pid: null });
  });

  test('returns running when PID file contains live process', () => {
    writePidFile(process.pid);
    expect(isDaemonRunning()).toEqual({ running: true, pid: process.pid });
  });

  test('cleans up stale PID file and returns not running', () => {
    const stalePid = 99999;
    writePidFile(stalePid);
    expect(isDaemonRunning()).toEqual({ running: false, pid: null });
    expect(fs.existsSync(path.join(tmpDir, '.junior', 'daemon.pid'))).toBe(false);
  });
});
