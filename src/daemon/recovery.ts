import fs from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { errorMessage } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import { abortMerge, forceDeleteBranch, isMergeInProgress, pruneWorktrees, removeWorktree } from '@/core/git.js';
import { info, warn } from '@/core/logger.js';
import { getWorktreesDir } from '@/core/paths.js';
import { getDb, schema } from '@/db/index.js';

export async function recoverOrphanedJobs(): Promise<void> {
  const db = getDb();

  const runningJobs = db.select().from(schema.jobs).where(eq(schema.jobs.status, 'running')).all();

  if (runningJobs.length > 0) {
    const repoPath = runningJobs[0].repoPath;
    try {
      if (await isMergeInProgress(repoPath)) {
        await abortMerge(repoPath);
        info('Aborted orphaned merge', { repoPath });
      }
    } catch (err) {
      warn('Failed to abort in-progress merge', {
        repoPath,
        error: errorMessage(err),
      });
    }
  }

  for (const job of runningJobs) {
    info('Recovering orphaned job', { jobId: job.id, title: job.title });

    const worktreePath = path.join(getWorktreesDir(), `job-${job.id}`);
    try {
      if (fs.existsSync(worktreePath)) {
        await removeWorktree(job.repoPath, worktreePath);
      }
    } catch (_gitErr) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch (err) {
        warn('Failed to remove orphaned worktree', {
          jobId: job.id,
          error: errorMessage(err),
        });
      }
    }

    if (job.branch) {
      try {
        await forceDeleteBranch(job.repoPath, job.branch);
      } catch (err) {
        warn('Failed to delete orphaned branch', {
          jobId: job.id,
          branch: job.branch,
          error: errorMessage(err),
        });
      }
    }

    db.update(schema.jobs)
      .set({ status: 'failed', cancelRequestedAt: null, updatedAt: sql`(unixepoch())` })
      .where(eq(schema.jobs.id, job.id))
      .run();
  }

  const runningRuns = db.select().from(schema.runs).where(eq(schema.runs.status, 'running')).all();

  for (const run of runningRuns) {
    db.update(schema.runs)
      .set({
        status: 'failed',
        errorMessage: 'Daemon crashed - orphaned run',
        finishedAt: sql`(unixepoch())`,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(schema.runs.id, run.id))
      .run();
  }

  try {
    if (fs.existsSync(getWorktreesDir())) {
      const entries = fs.readdirSync(getWorktreesDir());
      for (const entry of entries) {
        const worktreePath = path.join(getWorktreesDir(), entry);
        try {
          fs.rmSync(worktreePath, { recursive: true, force: true });
        } catch (err) {
          warn('Failed to clean worktree', {
            path: worktreePath,
            error: errorMessage(err),
          });
        }
      }
    }
  } catch (err) {
    warn('Failed to list worktrees directory', {
      error: errorMessage(err),
    });
  }

  if (runningJobs.length > 0) {
    try {
      await pruneWorktrees(runningJobs[0].repoPath);
    } catch (err) {
      warn('Failed to prune worktrees', {
        error: errorMessage(err),
      });
    }
  }

  if (runningJobs.length > 0 || runningRuns.length > 0) {
    notifyChange();
    info('Recovery complete', {
      orphanedJobs: runningJobs.length,
      orphanedRuns: runningRuns.length,
    });
  }
}
