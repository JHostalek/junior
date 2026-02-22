import { HOOK_EVAL_TIMEOUT_MS } from './constants.js';
import { HookError } from './errors.js';
import { warn } from './logger.js';
import type { HookContext } from './types.js';

export function createHookContext(repoPath: string, state: Record<string, unknown>): HookContext {
  return {
    repoPath,
    state,
    async git(...args: string[]): Promise<string> {
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
      return Bun.file(path).text();
    },
    async exec(cmd: string, args: string[]): Promise<string> {
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

const TIMEOUT = Symbol('hook_timeout');

export async function evaluateHook(checkFn: string, ctx: HookContext): Promise<boolean> {
  try {
    const fn = new Function('ctx', `return (async () => { ${checkFn} })()`) as (ctx: HookContext) => Promise<unknown>;
    const timeout = new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), HOOK_EVAL_TIMEOUT_MS));
    const result = await Promise.race([fn(ctx), timeout]);
    if (result === TIMEOUT) {
      warn('Hook evaluation timed out', { timeoutMs: HOOK_EVAL_TIMEOUT_MS });
      return false;
    }
    return Boolean(result);
  } catch {
    return false;
  }
}
