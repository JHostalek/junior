import { Cron } from 'croner';
import { z } from 'zod';
import { ClaudeError } from './errors.js';
import { Flag } from './flags.js';
import type { ClaudeResult } from './types.js';

export const CLAUDE_COMMAND = Flag.claudePath;

function cleanEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

export interface ExtractedSchedule {
  name: string;
  cron: string;
  prompt: string;
}

const extractedScheduleSchema = z.object({
  name: z.string().min(1),
  cron: z.string().min(1),
  prompt: z.string().min(1),
});

export async function extractSchedule(input: string): Promise<ExtractedSchedule> {
  const prompt = [
    'Parse the following natural-language schedule description into a JSON object with exactly three fields:',
    '- "name": a short, descriptive name for the schedule (lowercase, 2-5 words)',
    '- "cron": a standard 5-field cron expression (minute hour day-of-month month day-of-week)',
    '- "prompt": the task instructions that should be executed on each run',
    '',
    'Output ONLY valid JSON, nothing else. No explanation, no backticks, no markdown.',
    '',
    `Input: ${input}`,
  ].join('\n');

  const proc = Bun.spawn([CLAUDE_COMMAND, '-p', prompt, '--output-format', 'text'], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: cleanEnv(),
  });

  let output: string;
  try {
    output = await new Response(proc.stdout).text();
  } catch (err) {
    throw new ClaudeError(`Failed to read Claude output: ${err instanceof Error ? err.message : String(err)}`);
  }

  const code = await proc.exited;
  if (code !== 0) {
    let stderr = '';
    try {
      stderr = await new Response(proc.stderr).text();
    } catch {}
    throw new ClaudeError(`Failed to extract schedule (exit code ${code})${stderr ? `: ${stderr}` : ''}`);
  }

  const raw = output.trim();
  if (!raw) throw new ClaudeError('Empty response from Claude');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new ClaudeError(`No JSON found in Claude response: ${raw.slice(0, 200)}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new ClaudeError(`Invalid JSON in Claude response: ${jsonMatch[0].slice(0, 200)}`);
  }

  const result = extractedScheduleSchema.parse(parsed);

  try {
    new Cron(result.cron);
  } catch (err) {
    throw new ClaudeError(
      `Invalid cron expression "${result.cron}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}

export interface ExtractedHook {
  name: string;
  checkFn: string;
  prompt: string;
}

const extractedHookSchema = z.object({
  name: z.string().min(1),
  checkFn: z.string().min(1),
  prompt: z.string().min(1),
});

export async function extractHook(input: string): Promise<ExtractedHook> {
  const prompt = [
    'Parse the following natural-language hook description into a JSON object with exactly three fields:',
    '- "name": a short, descriptive name for the hook (lowercase, 2-5 words)',
    '- "checkFn": a JavaScript function body (NOT a full function declaration) that will be executed with a `ctx` object.',
    '  The ctx object has these methods:',
    '    ctx.git(...args: string[]): Promise<string> — run git commands and return stdout',
    '    ctx.readFile(path: string): Promise<string> — read a file and return its contents',
    '    ctx.exec(cmd: string, args: string[]): Promise<string> — run a command and return stdout',
    '    ctx.state: Record<string, unknown> — persistent state object preserved between checks',
    '    ctx.repoPath: string — absolute path to the repository',
    '  The function body should return true when the hook condition is met, false otherwise.',
    '  Use ctx.state to track previous values and detect changes between checks.',
    '- "prompt": the task instructions that should be executed when the hook fires',
    '',
    'Output ONLY valid JSON, nothing else. No explanation, no backticks, no markdown.',
    '',
    `Input: ${input}`,
  ].join('\n');

  const proc = Bun.spawn([CLAUDE_COMMAND, '-p', prompt, '--output-format', 'text'], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: cleanEnv(),
  });

  let output: string;
  try {
    output = await new Response(proc.stdout).text();
  } catch (err) {
    throw new ClaudeError(`Failed to read Claude output: ${err instanceof Error ? err.message : String(err)}`);
  }

  const code = await proc.exited;
  if (code !== 0) {
    let stderr = '';
    try {
      stderr = await new Response(proc.stderr).text();
    } catch {}
    throw new ClaudeError(`Failed to extract hook (exit code ${code})${stderr ? `: ${stderr}` : ''}`);
  }

  const raw = output.trim();
  if (!raw) throw new ClaudeError('Empty response from Claude');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new ClaudeError(`No JSON found in Claude response: ${raw.slice(0, 200)}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new ClaudeError(`Invalid JSON in Claude response: ${jsonMatch[0].slice(0, 200)}`);
  }

  return extractedHookSchema.parse(parsed);
}

const WORKER_PREAMBLE = [
  'You are a worker agent running inside the junior framework. Before implementing code changes, consider',
  "whether the task can be accomplished using junior's built-in features:",
  '- `junior hook add "<description>"` — Create reactive hooks that monitor conditions and auto-create tasks (e.g., "notify me when main changes")',
  '- `junior schedule add "<description>"` — Create scheduled recurring tasks',
  '',
  "Prefer using framework features over modifying the codebase when the user's request matches a framework capability.",
  '',
].join('\n');

export function buildClaudeArgs(prompt: string): string[] {
  return [
    '-p',
    WORKER_PREAMBLE + prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];
}

export function buildMergeConflictPrompt(worktreePath: string): string {
  return [
    `You are resolving merge conflicts in a git worktree at: ${worktreePath}`,
    ``,
    `The working directory has merge conflicts from a git merge. Resolve all conflicts:`,
    `1. Find all conflicted files (git diff --name-only --diff-filter=U)`,
    `2. Read each conflicted file and resolve the conflicts intelligently`,
    `3. Stage the resolved files (git add)`,
    `4. Commit the merge (git commit --no-edit)`,
    ``,
    `Do not skip any conflicted file. Resolve every conflict.`,
  ].join('\n');
}

export async function translateCron(input: string): Promise<string> {
  const prompt = [
    'Convert the following natural language schedule description into a standard 5-field cron expression (minute hour day-of-month month day-of-week).',
    'Output ONLY the cron expression, nothing else. No explanation, no backticks, no quotes.',
    '',
    `Input: ${input}`,
  ].join('\n');

  const proc = Bun.spawn([CLAUDE_COMMAND, '-p', prompt, '--output-format', 'text', '--model', 'haiku'], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: cleanEnv(),
  });

  let output: string;
  try {
    output = await new Response(proc.stdout).text();
  } catch (err) {
    throw new ClaudeError(`Failed to read Claude output: ${err instanceof Error ? err.message : String(err)}`);
  }

  const code = await proc.exited;
  if (code !== 0) {
    let stderr = '';
    try {
      stderr = await new Response(proc.stderr).text();
    } catch {}
    throw new ClaudeError(`Failed to translate cron expression (exit code ${code})${stderr ? `: ${stderr}` : ''}`);
  }

  const result = output.trim();
  if (!result) throw new ClaudeError('Empty response from Claude');
  return result;
}

export function parseClaudeOutput(output: string): ClaudeResult {
  const lines = output.trim().split('\n');

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.type === 'result') {
        const usage = (obj.usage || {}) as Record<string, unknown>;
        return {
          result: String(obj.result || ''),
          session_id: String(obj.session_id || ''),
          usage: {
            costUsd: Number(obj.total_cost_usd) || 0,
            inputTokens:
              (Number(usage.input_tokens) || 0) +
              (Number(usage.cache_creation_input_tokens) || 0) +
              (Number(usage.cache_read_input_tokens) || 0),
            outputTokens: Number(usage.output_tokens) || 0,
          },
        };
      }
    } catch {}
  }

  throw new ClaudeError(`No result found in Claude output: ${output.slice(0, 200)}`);
}
