import { describe, expect, test } from 'bun:test';
import { processStreamLine, type UsageAccumulator } from './executor.js';

function makeAcc(): UsageAccumulator {
  return { inputTokens: 0, outputTokens: 0, seenMessageIds: new Set() };
}

describe('processStreamLine', () => {
  test('empty line is no-op', () => {
    const acc = makeAcc();
    processStreamLine('', acc);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
    expect(acc.seenMessageIds.size).toBe(0);
  });

  test('valid assistant message accumulates tokens', () => {
    const acc = makeAcc();
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_001',
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 30,
          output_tokens: 75,
        },
      },
    });
    processStreamLine(line, acc);
    expect(acc.inputTokens).toBe(180);
    expect(acc.outputTokens).toBe(75);
  });

  test('duplicate message ID is skipped', () => {
    const acc = makeAcc();
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_dup',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    });
    processStreamLine(line, acc);
    processStreamLine(line, acc);
    expect(acc.inputTokens).toBe(100);
    expect(acc.outputTokens).toBe(50);
    expect(acc.seenMessageIds.size).toBe(1);
  });

  test('non-assistant type is ignored', () => {
    const acc = makeAcc();
    const line = JSON.stringify({
      type: 'tool_use',
      message: {
        id: 'msg_tool',
        usage: { input_tokens: 200, output_tokens: 100 },
      },
    });
    processStreamLine(line, acc);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
    expect(acc.seenMessageIds.size).toBe(0);
  });

  test('missing usage fields default to 0', () => {
    const acc = makeAcc();
    const line = JSON.stringify({
      type: 'assistant',
      message: { id: 'msg_nousage' },
    });
    processStreamLine(line, acc);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
    expect(acc.seenMessageIds.has('msg_nousage')).toBe(true);
  });

  test('invalid JSON is silently ignored', () => {
    const acc = makeAcc();
    processStreamLine('not json', acc);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
    expect(acc.seenMessageIds.size).toBe(0);
  });

  test('multiple valid messages accumulate correctly', () => {
    const acc = makeAcc();
    const line1 = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_a',
        usage: { input_tokens: 100, output_tokens: 40 },
      },
    });
    const line2 = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg_b',
        usage: { input_tokens: 200, output_tokens: 60 },
      },
    });
    processStreamLine(line1, acc);
    processStreamLine(line2, acc);
    expect(acc.inputTokens).toBe(300);
    expect(acc.outputTokens).toBe(100);
    expect(acc.seenMessageIds.size).toBe(2);
  });

  test('message without ID is skipped', () => {
    const acc = makeAcc();
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        usage: { input_tokens: 500, output_tokens: 200 },
      },
    });
    processStreamLine(line, acc);
    expect(acc.inputTokens).toBe(0);
    expect(acc.outputTokens).toBe(0);
    expect(acc.seenMessageIds.size).toBe(0);
  });
});
