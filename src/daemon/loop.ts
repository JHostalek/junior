import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { loadConfig } from '@/core/config.js';
import { SHUTDOWN_TIMEOUT_MS } from '@/core/constants.js';
import { errorMessage } from '@/core/errors.js';
import { info, error as logError, warn } from '@/core/logger.js';
import { getDb, schema } from '@/db/index.js';
import { executeJob } from './executor.js';

const activeJobs = new Map<number, Promise<void>>();
const settledJobs = new Set<number>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function trackJob(jobId: number, promise: Promise<void>): void {
  activeJobs.set(jobId, promise);
  promise.finally(() => settledJobs.add(jobId));
}

export async function checkForQueuedJobs(): Promise<void> {
  const config = loadConfig();

  for (const jobId of settledJobs) {
    activeJobs.delete(jobId);
  }
  settledJobs.clear();

  if (activeJobs.size >= config.max_concurrency) {
    return;
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const candidates = db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.status, 'queued'), or(isNull(schema.jobs.runAt), lte(schema.jobs.runAt, now))))
    .orderBy(asc(schema.jobs.createdAt))
    .all();

  for (const job of candidates) {
    if (activeJobs.size >= config.max_concurrency) {
      break;
    }
    if (activeJobs.has(job.id)) {
      continue;
    }

    info('Picking up job', { jobId: job.id, title: job.title });

    const jobPromise = executeJob(job).catch((err) => {
      logError('Unhandled error in job execution', {
        jobId: job.id,
        error: errorMessage(err),
      });
    });

    trackJob(job.id, jobPromise);
  }
}

function handlePollError(err: unknown): void {
  logError('Poll error', { error: errorMessage(err) });
}

export function startPollLoop(intervalMs: number): void {
  info('Starting poll loop', { intervalMs });
  checkForQueuedJobs().catch(handlePollError);

  pollTimer = setInterval(() => {
    checkForQueuedJobs().catch(handlePollError);
  }, intervalMs);
}

export async function stopPollLoop(timeoutMs: number = SHUTDOWN_TIMEOUT_MS): Promise<void> {
  info('Stopping poll loop');
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  if (activeJobs.size === 0) {
    return;
  }

  info('Waiting for active jobs to complete', { count: activeJobs.size });

  const allJobs = Promise.allSettled(Array.from(activeJobs.values()));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([allJobs, timeout]);

  if (activeJobs.size > 0) {
    warn('Timed out waiting for active jobs', { remaining: activeJobs.size });
  }
}
