import { HOOK_EVAL_TIMEOUT_MS } from './constants.js';
import type { WorkerRequest, WorkerResponse } from './hook-worker.js';
import { warn } from './logger.js';
import type { HookEvalResult } from './types.js';

const workerUrl = new URL('./hook-worker.ts', import.meta.url).href;

let pooledWorker: Worker | undefined;

function getWorker(): Worker {
  if (!pooledWorker) {
    pooledWorker = new Worker(workerUrl, { smol: true });
    pooledWorker.addEventListener('close', () => {
      pooledWorker = undefined;
    });
  }
  return pooledWorker;
}

export function shutdownHookWorker(): void {
  if (pooledWorker) {
    pooledWorker.terminate();
    pooledWorker = undefined;
  }
}

export interface EvaluateHookOptions {
  checkFn: string;
  repoPath: string;
  state: Record<string, unknown>;
  allowedCommands: string[] | undefined;
}

export async function evaluateHook(opts: EvaluateHookOptions): Promise<HookEvalResult> {
  const worker = getWorker();
  const request: WorkerRequest = {
    checkFn: opts.checkFn,
    repoPath: opts.repoPath,
    state: opts.state,
    allowedCommands: opts.allowedCommands,
  };
  return new Promise<HookEvalResult>((resolve) => {
    const timer = setTimeout(() => {
      warn('Hook evaluation timed out', { timeoutMs: HOOK_EVAL_TIMEOUT_MS });
      pooledWorker?.terminate();
      pooledWorker = undefined;
      resolve({ triggered: false, state: opts.state, error: `Timed out after ${HOOK_EVAL_TIMEOUT_MS}ms` });
    }, HOOK_EVAL_TIMEOUT_MS);

    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      const response = event.data;
      if (response.ok) {
        resolve({ triggered: response.triggered, state: response.state, error: undefined });
      } else {
        resolve({ triggered: false, state: response.state, error: response.error });
      }
    };

    const onError = (event: ErrorEvent) => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      pooledWorker?.terminate();
      pooledWorker = undefined;
      resolve({ triggered: false, state: opts.state, error: String(event.message ?? event) });
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(request);
  });
}
