import { describe, expect, test } from 'bun:test';
import { buildClaudeArgs, buildMergeConflictPrompt, parseClaudeOutput } from './claude.js';
import { ClaudeError } from './errors.js';

describe('buildClaudeArgs', () => {
  test('returns correct argument array with worker preamble prepended', () => {
    const args = buildClaudeArgs('fix the bug');
    expect(args[0]).toBe('-p');
    expect(args[1]).toContain('junior framework');
    expect(args[1]).toContain('junior hook add');
    expect(args[1]).toContain('junior schedule add');
    expect(args[1]).toEndWith('fix the bug');
    expect(args.slice(2)).toEqual(['--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions']);
  });
});

describe('buildMergeConflictPrompt', () => {
  test('includes the worktree path', () => {
    const prompt = buildMergeConflictPrompt('/tmp/worktree-1');
    expect(prompt).toContain('/tmp/worktree-1');
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
