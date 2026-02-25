import { HOOK_EVAL_TIMEOUT_MS } from './constants.js';
import type { WorkerRequest, WorkerResponse } from './hook-worker.js';
import { warn } from './logger.js';
import type { HookEvalResult } from './types.js';

const workerUrl = new URL('./hook-worker.ts', import.meta.url).href;

export interface EvaluateHookOptions {
  checkFn: string;
  repoPath: string;
  state: Record<string, unknown>;
  allowedCommands: string[] | undefined;
}

export async function evaluateHook(opts: EvaluateHookOptions): Promise<HookEvalResult> {
  const worker = new Worker(workerUrl, { smol: true });
  try {
    const request: WorkerRequest = {
      checkFn: opts.checkFn,
      repoPath: opts.repoPath,
      state: opts.state,
      allowedCommands: opts.allowedCommands,
    };
    const result = await new Promise<HookEvalResult>((resolve) => {
      const timer = setTimeout(() => {
        warn('Hook evaluation timed out', { timeoutMs: HOOK_EVAL_TIMEOUT_MS });
        resolve({ triggered: false, state: opts.state, error: `Timed out after ${HOOK_EVAL_TIMEOUT_MS}ms` });
      }, HOOK_EVAL_TIMEOUT_MS);

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        clearTimeout(timer);
        const response = event.data;
        if (response.ok) {
          resolve({ triggered: response.triggered, state: response.state, error: undefined });
        } else {
          resolve({ triggered: false, state: response.state, error: response.error });
        }
      };

      worker.onerror = (event) => {
        clearTimeout(timer);
        resolve({ triggered: false, state: opts.state, error: String(event.message ?? event) });
      };

      worker.postMessage(request);
    });
    return result;
  } finally {
    worker.terminate();
  }
}
