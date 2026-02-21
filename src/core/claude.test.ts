import { describe, expect, test } from 'bun:test';
import {
  buildClaudeArgs,
  buildFinalizeArgs,
  buildFinalizePrompt,
  buildWorkerPreamble,
  parseClaudeOutput,
} from './claude.js';
import { ClaudeError } from './errors.js';

describe('buildClaudeArgs', () => {
  test('includes worker preamble before the prompt without MCP', () => {
    const args = buildClaudeArgs({ prompt: 'fix the bug' });
    expect(args[0]).toBe('-p');
    expect(args[1]).toContain('autonomous worker agent');
    expect(args[1]).toEndWith('\nfix the bug');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('--verbose');
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--mcp-config');
  });

  test('includes --mcp-config when mcpConfigPath is provided', () => {
    const args = buildClaudeArgs({ prompt: 'fix the bug', mcpConfigPath: '/repo/.mcp.json' });
    const idx = args.indexOf('--mcp-config');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('/repo/.mcp.json');
    expect(args[1]).toContain('mcp__junior__');
  });

  test('MCP unavailable preamble tells agent not to use MCP tools', () => {
    const args = buildClaudeArgs({ prompt: 'do stuff' });
    expect(args[1]).toContain('Do not attempt to create schedules, hooks, or tasks');
    expect(args[1]).not.toContain('mcp__junior__');
  });
});

describe('buildWorkerPreamble', () => {
  test('mentions MCP tools when available', () => {
    const preamble = buildWorkerPreamble(true);
    expect(preamble).toContain('mcp__junior__');
  });

  test('warns against MCP usage when unavailable', () => {
    const preamble = buildWorkerPreamble(false);
    expect(preamble).toContain('Do not attempt to create schedules, hooks, or tasks');
    expect(preamble).not.toContain('mcp__junior__');
  });
});

describe('buildFinalizePrompt', () => {
  const opts = {
    repoPath: '/home/user/repo',
    worktreePath: '/home/user/.junior/worktrees/job-42',
    branchName: 'junior/fix-bug-42',
    baseBranch: 'main',
    jobTitle: 'fix login bug',
  };

  test('includes all context parameters', () => {
    const prompt = buildFinalizePrompt(opts);
    expect(prompt).toContain(opts.repoPath);
    expect(prompt).toContain(opts.worktreePath);
    expect(prompt).toContain(opts.branchName);
    expect(prompt).toContain(opts.baseBranch);
    expect(prompt).toContain(opts.jobTitle);
  });

  test('includes commit step instructions', () => {
    const prompt = buildFinalizePrompt(opts);
    expect(prompt).toContain('STEP 1');
    expect(prompt).toContain('status --porcelain');
    expect(prompt).toContain('commitlint');
  });

  test('includes merge conflict resolution instructions', () => {
    const prompt = buildFinalizePrompt(opts);
    expect(prompt).toContain('STEP 2');
    expect(prompt).toContain('merge conflicts');
    expect(prompt).toContain('diff-filter=U');
  });

  test('includes merge into base branch instructions', () => {
    const prompt = buildFinalizePrompt(opts);
    expect(prompt).toContain('STEP 3');
    expect(prompt).toContain('merge --no-ff');
    expect(prompt).toContain('junior-autostash');
  });

  test('includes safety rules about not modifying source code', () => {
    const prompt = buildFinalizePrompt(opts);
    expect(prompt).toContain('Do NOT modify any source code');
    expect(prompt).toContain('no --no-verify');
    expect(prompt).toContain('last resort');
  });
});

describe('buildFinalizeArgs', () => {
  test('returns correct flags without worker preamble', () => {
    const args = buildFinalizeArgs('finalize prompt');
    expect(args[0]).toBe('-p');
    expect(args[1]).toBe('finalize prompt');
    expect(args[1]).not.toContain('junior framework');
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
    expect(args).toContain('--verbose');
    expect(args).toContain('--dangerously-skip-permissions');
  });

  test('includes --model sonnet for cost efficiency', () => {
    const args = buildFinalizeArgs('prompt');
    const modelIdx = args.indexOf('--model');
    expect(modelIdx).toBeGreaterThan(-1);
    expect(args[modelIdx + 1]).toBe('sonnet');
  });
});

describe('parseClaudeOutput', () => {
  test('parses a valid result line', () => {
    const output = JSON.stringify({
      type: 'result',
      result: 'Task completed successfully',
      session_id: 'sess-123',
      total_cost_usd: 0.05,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    });
    const result = parseClaudeOutput(output);
    expect(result.result).toBe('Task completed successfully');
    expect(result.session_id).toBe('sess-123');
    expect(result.usage.costUsd).toBe(0.05);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  test('finds result line among multiple lines', () => {
    const lines = [
      JSON.stringify({ type: 'assistant', message: 'working...' }),
      JSON.stringify({ type: 'tool_use', name: 'bash' }),
      JSON.stringify({
        type: 'result',
        result: 'Done',
        session_id: 'sess-456',
        total_cost_usd: 0.1,
        usage: { input_tokens: 200, output_tokens: 100 },
      }),
    ];
    const result = parseClaudeOutput(lines.join('\n'));
    expect(result.result).toBe('Done');
    expect(result.session_id).toBe('sess-456');
  });

  test('uses the last result line when multiple exist', () => {
    const lines = [
      JSON.stringify({
        type: 'result',
        result: 'First result',
        session_id: 'sess-1',
        total_cost_usd: 0.01,
        usage: {},
      }),
      JSON.stringify({ type: 'assistant', message: 'more work' }),
      JSON.stringify({
        type: 'result',
        result: 'Second result',
        session_id: 'sess-2',
        total_cost_usd: 0.02,
        usage: {},
      }),
    ];
    const result = parseClaudeOutput(lines.join('\n'));
    expect(result.result).toBe('Second result');
    expect(result.session_id).toBe('sess-2');
  });

  test('handles cache tokens in usage calculation', () => {
    const output = JSON.stringify({
      type: 'result',
      result: 'ok',
      session_id: 'sess-789',
      total_cost_usd: 0.2,
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 30,
        output_tokens: 75,
      },
    });
    const result = parseClaudeOutput(output);
    expect(result.usage.inputTokens).toBe(180);
    expect(result.usage.outputTokens).toBe(75);
  });

  test('handles missing usage fields gracefully', () => {
    const output = JSON.stringify({
      type: 'result',
      result: 'ok',
      session_id: 'sess-abc',
      usage: {},
    });
    const result = parseClaudeOutput(output);
    expect(result.usage.costUsd).toBe(0);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  test('handles missing usage object entirely', () => {
    const output = JSON.stringify({
      type: 'result',
      result: 'ok',
      session_id: 'sess-abc',
    });
    const result = parseClaudeOutput(output);
    expect(result.usage.costUsd).toBe(0);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  test('handles missing result field', () => {
    const output = JSON.stringify({
      type: 'result',
      session_id: 'sess-abc',
      usage: {},
    });
    const result = parseClaudeOutput(output);
    expect(result.result).toBe('');
  });

  test('handles missing session_id field', () => {
    const output = JSON.stringify({
      type: 'result',
      result: 'ok',
      usage: {},
    });
    const result = parseClaudeOutput(output);
    expect(result.session_id).toBe('');
  });

  test('throws ClaudeError when no result line found', () => {
    const output = JSON.stringify({ type: 'assistant', message: 'hello' });
    expect(() => parseClaudeOutput(output)).toThrow(ClaudeError);
  });

  test('throws ClaudeError with output preview for empty input', () => {
    expect(() => parseClaudeOutput('')).toThrow(ClaudeError);
  });

  test('throws ClaudeError for invalid JSON', () => {
    expect(() => parseClaudeOutput('not valid json at all')).toThrow(ClaudeError);
  });

  test('skips invalid JSON lines and finds valid result', () => {
    const lines = [
      'not json',
      '{ broken json',
      JSON.stringify({ type: 'result', result: 'found', session_id: 's', usage: {} }),
    ];
    const result = parseClaudeOutput(lines.join('\n'));
    expect(result.result).toBe('found');
  });

  test('skips non-result JSON lines', () => {
    const lines = [
      JSON.stringify({ type: 'progress', percent: 50 }),
      JSON.stringify({ type: 'result', result: 'final', session_id: 's', usage: {} }),
    ];
    const result = parseClaudeOutput(lines.join('\n'));
    expect(result.result).toBe('final');
  });

  test('handles output with trailing whitespace and empty lines', () => {
    const output = `\n\n${JSON.stringify({ type: 'result', result: 'ok', session_id: 's', usage: {} })}\n\n  \n`;
    const result = parseClaudeOutput(output);
    expect(result.result).toBe('ok');
  });

  test('error message includes truncated output', () => {
    const longOutput = 'x'.repeat(300);
    try {
      parseClaudeOutput(longOutput);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ClaudeError);
      expect((err as ClaudeError).message).toContain(longOutput.slice(0, 200));
      expect((err as ClaudeError).message.length).toBeLessThan(300);
    }
  });

  test('inherits from JuniorError', () => {
    try {
      parseClaudeOutput('invalid');
    } catch (err) {
      expect((err as Error).name).toBe('ClaudeError');
    }
  });

  test('total_cost_usd maps to costUsd', () => {
    const output = JSON.stringify({
      type: 'result',
      result: '',
      session_id: '',
      total_cost_usd: 1.2345,
      usage: {},
    });
    const result = parseClaudeOutput(output);
    expect(result.usage.costUsd).toBe(1.2345);
  });

  test('handles zero token counts', () => {
    const output = JSON.stringify({
      type: 'result',
      result: '',
      session_id: '',
      total_cost_usd: 0,
      usage: {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0,
      },
    });
    const result = parseClaudeOutput(output);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.costUsd).toBe(0);
  });
});
