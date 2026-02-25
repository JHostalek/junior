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

  return {
    repoPath,
    state,
    async git(...args: string[]): Promise<string> {
      const subcommand = args[0];
      if (!subcommand || !GIT_READ_ONLY_COMMANDS.has(subcommand)) {
        throw new HookError(`git subcommand not allowed: ${subcommand ?? '(empty)'}`);
      }
      const proc = Bun.spawn(['git', ...args], {
        cwd: repoPath,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const output = await new Response(proc.stdout).text();
      const code = await proc.exited;
      if (code !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new HookError(`git ${args.join(' ')} failed (exit ${code}): ${stderr.trim()}`);
      }
      return output.trim();
    },
    async readFile(path: string): Promise<string> {
      const resolved = resolve(repoPath, path);
      if (!resolved.startsWith(`${repoPath}/`) && resolved !== repoPath) {
        throw new HookError(`readFile path outside repo: ${path}`);
      }
      return Bun.file(resolved).text();
    },
    async exec(cmd: string, args: string[]): Promise<string> {
      if (allowlist && !allowlist.has(cmd)) {
        throw new HookError(`command not allowed: ${cmd}. Allowed: ${[...allowlist].join(', ')}`);
      }
      const proc = Bun.spawn([cmd, ...args], {
        cwd: repoPath,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const output = await new Response(proc.stdout).text();
      const code = await proc.exited;
      if (code !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new HookError(`${cmd} ${args.join(' ')} failed (exit ${code}): ${stderr.trim()}`);
      }
      return output.trim();
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
