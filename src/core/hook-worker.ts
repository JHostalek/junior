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
}

export interface WorkerResponse {
  ok: boolean;
  triggered: boolean;
  state: Record<string, unknown>;
  error?: string;
}

function buildRestrictedContext(
  repoPath: string,
  state: Record<string, unknown>,
): {
  git: (...args: string[]) => Promise<string>;
  readFile: (path: string) => Promise<string>;
  state: Record<string, unknown>;
  repoPath: string;
} {
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
  };
}

declare var self: Worker;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { checkFn, repoPath, state } = event.data;
  try {
    const ctx = buildRestrictedContext(repoPath, state);
    const fn = new Function('ctx', `return (async () => { ${checkFn} })()`) as (
      ctx: ReturnType<typeof buildRestrictedContext>,
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
