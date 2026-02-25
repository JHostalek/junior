import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectMcp } from './mcp.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('detectMcp', () => {
  test('returns available when junior server is present', () => {
    const config = { mcpServers: { junior: { command: 'junior-mcp' } } };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
    const result = detectMcp(tmpDir);
    expect(result.available).toBe(true);
    expect(result.configPath).toBe(path.join(tmpDir, '.mcp.json'));
  });

  test('returns unavailable when junior key is absent', () => {
    const config = { mcpServers: { other: { command: 'other-mcp' } } };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
    const result = detectMcp(tmpDir);
    expect(result.available).toBe(false);
    expect(result.configPath).toBeUndefined();
  });

  test('returns unavailable when .mcp.json is missing', () => {
    const result = detectMcp(tmpDir);
    expect(result.available).toBe(false);
  });

  test('returns unavailable for invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), 'not json');
    const result = detectMcp(tmpDir);
    expect(result.available).toBe(false);
  });

  test('returns unavailable when mcpServers key is missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify({ other: true }));
    const result = detectMcp(tmpDir);
    expect(result.available).toBe(false);
  });

  test('reflects file changes between calls', () => {
    const config = { mcpServers: { junior: { command: 'junior-mcp' } } };
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), JSON.stringify(config));
    expect(detectMcp(tmpDir).available).toBe(true);
    fs.unlinkSync(path.join(tmpDir, '.mcp.json'));
    expect(detectMcp(tmpDir).available).toBe(false);
  });
});
