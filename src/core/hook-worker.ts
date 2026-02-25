import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { HookError } from './errors.js';

const GIT_READ_ONLY_COMMANDS = new Set([
  'status',
  'log',
  'diff',
  'show',
  'rev-parse',
  'branch',
  'tag',
  'ls-files',
  'ls-tree',
  'cat-file',
  'remote',
  'rev-list',
  'describe',
  'name-rev',
  'shortlog',
  'blame',
  'count-objects',
  'for-each-ref',
  'merge-base',
]);

export interface WorkerRequest {
  checkFn: string;
  repoPath: string;
  state: Record<string, unknown>;
  allowedCommands: string[] | undefined;
}

export interface WorkerResponse {
  ok: boolean;
  triggered: boolean;
  state: Record<string, unknown>;
  error?: string;
}

const MAX_OUTPUT_BYTES = 1_000_000;

function truncate(s: string): string {
  return s.length > MAX_OUTPUT_BYTES ? s.slice(0, MAX_OUTPUT_BYTES) : s;
}

async function runProcess(cmd: string[], cwd: string): Promise<{ output: string; stderr: string; code: number }> {
  const proc = Bun.spawn(cmd, { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const [output, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  return { output: truncate(output).trim(), stderr: truncate(stderr).trim(), code };
}

function buildHookContext(
  repoPath: string,
  state: Record<string, unknown>,
  allowedCommands: string[] | undefined,
): {
  git: (...args: string[]) => Promise<string>;
  readFile: (path: string) => Promise<string>;
  exec: (cmd: string, args: string[]) => Promise<string>;
  state: Record<string, unknown>;
  repoPath: string;
} {
  const allowlist = allowedCommands ? new Set(allowedCommands) : undefined;
  const realRepo = realpathSync(repoPath);

  return {
    repoPath,
    state,
    async git(...args: string[]): Promise<string> {
      const subcommand = args[0];
      if (!subcommand || !GIT_READ_ONLY_COMMANDS.has(subcommand)) {
        throw new HookError(`git subcommand not allowed: ${subcommand ?? '(empty)'}`);
      }
      const { output, stderr, code } = await runProcess(['git', ...args], repoPath);
      if (code !== 0) {
        throw new HookError(`git ${args.join(' ')} failed (exit ${code}): ${stderr}`);
      }
      return output;
    },
    async readFile(path: string): Promise<string> {
      const resolved = resolve(repoPath, path);
      let realResolved: string;
      try {
        realResolved = realpathSync(resolved);
      } catch {
        throw new HookError(`readFile failed: ${path} does not exist`);
      }
      if (!realResolved.startsWith(`${realRepo}/`) && realResolved !== realRepo) {
        throw new HookError(`readFile path outside repo: ${path}`);
      }
      return Bun.file(realResolved).text();
    },
    async exec(cmd: string, args: string[]): Promise<string> {
      if (allowlist && !allowlist.has(cmd)) {
        throw new HookError(`command not allowed: ${cmd}. Allowed: ${[...allowlist].join(', ')}`);
      }
      const { output, stderr, code } = await runProcess([cmd, ...args], repoPath);
      if (code !== 0) {
        throw new HookError(`${cmd} ${args.join(' ')} failed (exit ${code}): ${stderr}`);
      }
      return output;
    },
  };
}

declare var self: Worker;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { checkFn, repoPath, state, allowedCommands } = event.data;
  try {
    const ctx = buildHookContext(repoPath, state, allowedCommands);
    const fn = new Function('ctx', `return (async () => { ${checkFn} })()`) as (
      ctx: ReturnType<typeof buildHookContext>,
    ) => Promise<unknown>;
    const result = await fn(ctx);
    const response: WorkerResponse = { ok: true, triggered: Boolean(result), state: ctx.state };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      ok: false,
      triggered: false,
      state,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
