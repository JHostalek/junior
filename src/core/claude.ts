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

export function buildWorkerPreamble(mcpAvailable: boolean): string {
  const lines = [
    'You are an autonomous worker agent in the Junior framework.',
    'Execute the task completely. Do not ask for confirmation, do not explain what you would do — just do it.',
  ];

  if (mcpAvailable) {
    lines.push(
      'You have access to the `junior` CLI and MCP tools (mcp__junior__*) for managing schedules, hooks, and tasks.',
      'If the task involves creating a schedule, hook, or task, use the MCP tools or run `junior schedule add`, `junior hook add`, or `junior task add` directly.',
    );
  } else {
    lines.push(
      'Junior MCP tools are not available. Do not attempt to create schedules, hooks, or tasks.',
      'Focus only on the code task described below.',
    );
  }

  lines.push('', 'Task:');
  return lines.join('\n');
}

export interface BuildClaudeArgsOptions {
  prompt: string;
  mcpConfigPath?: string;
}

export function buildClaudeArgs(opts: BuildClaudeArgsOptions): string[] {
  const preamble = buildWorkerPreamble(opts.mcpConfigPath !== undefined);
  const fullPrompt = `${preamble}\n${opts.prompt}`;
  const args = ['-p', fullPrompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
  if (opts.mcpConfigPath) {
    args.push('--mcp-config', opts.mcpConfigPath);
  }
  return args;
}

export interface FinalizePromptOptions {
  repoPath: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string;
  jobTitle: string;
}

export function buildFinalizePrompt(opts: FinalizePromptOptions): string {
  return [
    'You are a git finalize agent. Your ONLY job is to commit and merge code changes.',
    'You must NOT modify any source code. Only run git commands.',
    '',
    'Context:',
    `- Repository: ${opts.repoPath}`,
    `- Worktree: ${opts.worktreePath}`,
    `- Feature branch: ${opts.branchName} (in the worktree)`,
    `- Base branch: ${opts.baseBranch}`,
    `- Task that was completed: ${opts.jobTitle}`,
    '',
    'Execute these steps in order:',
    '',
    'STEP 1 — COMMIT WORKTREE CHANGES (if needed)',
    `Check if the worktree at ${opts.worktreePath} has uncommitted changes:`,
    `  git -C ${opts.worktreePath} status --porcelain`,
    'If there are changes:',
    `1. git -C ${opts.worktreePath} add -A`,
    `2. git -C ${opts.worktreePath} diff --cached --stat  (review what you're committing)`,
    '3. Look for commit message conventions in the repo (check for commitlint config,',
    '   .commitlintrc, package.json commitlint field, etc.)',
    `4. git -C ${opts.worktreePath} commit with a message following the repo's conventions`,
    '   - If conventional commits: pick the right type (feat/fix/refactor/chore) based on the diff',
    '   - If hooks reject the commit, read the error and fix the message accordingly',
    `If there are no changes, check if there are already commits ahead of ${opts.baseBranch}:`,
    `  git -C ${opts.worktreePath} log ${opts.baseBranch}..HEAD --oneline`,
    `If no changes AND no commits ahead, there is nothing to merge — report this and stop.`,
    '',
    `STEP 2 — MERGE BASE BRANCH INTO WORKTREE (catch up)`,
    'Merge the base branch into the worktree to catch up with any changes:',
    `  git -C ${opts.worktreePath} merge ${opts.baseBranch} --no-edit`,
    'If there are merge conflicts:',
    `1. git -C ${opts.worktreePath} diff --name-only --diff-filter=U  (find conflicted files)`,
    '2. Read each conflicted file and resolve the conflicts intelligently',
    `3. git -C ${opts.worktreePath} add <resolved files>`,
    `4. git -C ${opts.worktreePath} commit --no-edit`,
    '',
    'STEP 3 — MERGE INTO BASE BRANCH',
    '1. Check for uncommitted changes in the main repo:',
    `   git -C ${opts.repoPath} status --porcelain`,
    `   If dirty: git -C ${opts.repoPath} stash push -m "junior-autostash"`,
    `2. git -C ${opts.repoPath} checkout ${opts.baseBranch}`,
    `3. git -C ${opts.repoPath} merge --no-ff ${opts.branchName} -m "<message>"`,
    "   - Use a merge commit message following the repo's conventions",
    '   - If hooks reject the message, read the error and fix it',
    `4. If you stashed in step 1: git -C ${opts.repoPath} stash pop`,
    `5. Verify: git -C ${opts.repoPath} log --oneline -1`,
    '',
    'IMPORTANT RULES:',
    '- Do NOT modify any source code files. Only git operations.',
    '- Do NOT skip pre-commit hooks (no --no-verify) unless you have exhausted all other options.',
    '- If a hook fails, read the error output carefully and adapt your approach.',
    '- If after 3 attempts a commit/merge still fails on hooks, use --no-verify as last resort.',
    '- Always use -C <path> for git commands — never cd.',
  ].join('\n');
}

export function buildFinalizeArgs(prompt: string): string[] {
  return [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--model',
    'sonnet',
  ];
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
