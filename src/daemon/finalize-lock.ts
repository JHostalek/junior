import { info } from '@/core/logger.js';

export const locks = new Map<string, Promise<void>>();

export async function withFinalizeLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(repoPath);
  if (prev) {
    info('Waiting for finalize lock', { repoPath });
  }

  const barrier = prev ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  locks.set(repoPath, next);

  try {
    await barrier;
    return await fn();
  } finally {
    resolve();
    if (locks.get(repoPath) === next) {
      locks.delete(repoPath);
    }
  }
}
