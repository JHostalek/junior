import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { desc, eq, sql } from 'drizzle-orm';
import { LOG_WATCH_INTERVAL_MS, TITLE_MAX_LENGTH } from '@/core/constants.js';
import { errorMessage, JuniorError } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import { forceDeleteBranch, getCurrentBranch, pruneWorktrees, removeWorktree } from '@/core/git.js';
import { warn } from '@/core/logger.js';
import { getRepoPath, getWorktreesDir } from '@/core/paths.js';
import type { JobStatus } from '@/core/types.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import { cliAction, getJobOrExit, printTable } from './helpers.js';

export const taskCommand = new Command('task').description('Manage tasks');

taskCommand
  .command('add')
  .description('Add a new task')
  .argument('<description>', 'What to do (plain text, like a GitHub issue)')
  .action(
    cliAction(async (description: string) => {
      ensureInit();
      const db = getDb();
      const repoPath = getRepoPath();
      const title = description.split('\n')[0].slice(0, TITLE_MAX_LENGTH);
      const baseBranch = await getCurrentBranch(repoPath);

      const result = db
        .insert(schema.jobs)
        .values({
          title,
          prompt: description,
          repoPath,
          baseBranch,
        })
        .returning()
        .get();

      console.log(`Task #${result.id} queued: ${result.title}`);
    }),
  );

export type ListOpts = { status?: string; json?: boolean };

export function listAction(opts: ListOpts) {
  ensureInit();
  const db = getDb();

  const rows = opts.status
    ? db.select().from(schema.jobs).where(eq(schema.jobs.status, opts.status)).all()
    : db.select().from(schema.jobs).all();

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('No tasks found.');
    return;
  }

  printTable(
    [
      { header: 'ID', width: 5, value: (row) => String(row.id) },
      { header: 'STATUS', width: 12, value: (row) => String(row.status) },
      { header: 'TITLE', width: 50, value: (row) => String(row.title) },
    ],
    rows as unknown as Record<string, unknown>[],
  );
}

taskCommand
  .command('list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('--json', 'Output as JSON')
  .action(cliAction((opts: ListOpts) => listAction(opts)));

taskCommand
  .command('show')
  .description('Show task details')
  .argument('<id>', 'Task ID')
  .action(
    cliAction((id: string) => {
      const job = getJobOrExit(id);
      const db = getDb();

      console.log(`Task #${job.id}`);
      console.log(`  Status:   ${job.status}`);
      console.log(`  Branch:   ${job.branch ?? '(pending)'}`);
      console.log(`  Created:  ${job.createdAt ? new Date(job.createdAt * 1000).toISOString() : 'N/A'}`);
      console.log(`\n  ${job.prompt}`);

      const runs = db
        .select()
        .from(schema.runs)
        .where(eq(schema.runs.jobId, Number(id)))
        .all();

      if (runs.length > 0) {
        console.log(`\n  Runs (${runs.length}):`);
        for (const run of runs) {
          const started = run.startedAt ? new Date(run.startedAt * 1000).toISOString() : 'N/A';
          const finished = run.finishedAt ? new Date(run.finishedAt * 1000).toISOString() : '(running)';
          console.log(`    #${run.attempt} ${run.status}  ${started} → ${finished}`);
          if (run.errorMessage) {
            console.log(`       Error: ${run.errorMessage}`);
          }
        }
      }
    }),
  );

taskCommand
  .command('cancel')
  .description('Cancel a queued or running task')
  .argument('<id>', 'Task ID')
  .action(
    cliAction((id: string) => {
      const job = getJobOrExit(id);
      const db = getDb();

      if (job.status === 'queued') {
        db.update(schema.jobs).set({ status: 'cancelled' }).where(eq(schema.jobs.id, job.id)).run();
        notifyChange();
        console.log(`Task #${id} cancelled.`);
      } else if (job.status === 'running') {
        db.update(schema.jobs).set({ cancelRequestedAt: sql`(unixepoch())` }).where(eq(schema.jobs.id, job.id)).run();
        notifyChange();
        console.log(`Task #${id} cancel requested (daemon will stop it shortly).`);
      } else {
        console.error(`Task #${id} is ${job.status}, can only cancel queued or running tasks.`);
        process.exit(1);
      }
    }),
  );

taskCommand
  .command('retry')
  .description('Re-queue a completed, failed, or cancelled task')
  .argument('<id>', 'Task ID')
  .action(
    cliAction((id: string) => {
      const job = getJobOrExit(id);
      const db = getDb();

      const retryable: JobStatus[] = ['failed', 'cancelled', 'done'];
      if (!retryable.includes(job.status as JobStatus)) {
        console.error(`Task #${id} is ${job.status}, can only retry failed, cancelled, or done tasks.`);
        process.exit(1);
      }

      db.update(schema.jobs).set({ status: 'queued', runAt: null }).where(eq(schema.jobs.id, job.id)).run();
      notifyChange();

      console.log(`Task #${id} re-queued.`);
    }),
  );

export async function deleteJob(jobId: number): Promise<void> {
  const db = getDb();
  const job = db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
  if (!job) throw new JuniorError(`Task #${jobId} not found`);
  if (job.status === 'running') throw new JuniorError(`Task #${jobId} is running, cancel it first`);

  const runs = db.select().from(schema.runs).where(eq(schema.runs.jobId, jobId)).all();
  for (const run of runs) {
    if (run.logFile) {
      try {
        fs.unlinkSync(run.logFile);
      } catch {}
    }
  }

  const worktreePath = path.join(getWorktreesDir(), `job-${jobId}`);
  if (fs.existsSync(worktreePath)) {
    try {
      await removeWorktree(job.repoPath, worktreePath);
    } catch {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch (cleanupError) {
        warn('Failed to remove worktree during delete', { jobId, error: errorMessage(cleanupError) });
      }
    }
  }

  if (job.branch) {
    try {
      await forceDeleteBranch(job.repoPath, job.branch);
    } catch {}
  }

  try {
    await pruneWorktrees(job.repoPath);
  } catch {}

  db.delete(schema.jobs).where(eq(schema.jobs.id, jobId)).run();
  notifyChange();
}

taskCommand
  .command('delete')
  .description('Delete a task and all its data')
  .argument('<id>', 'Task ID')
  .action(
    cliAction(async (id: string) => {
      const job = getJobOrExit(id);
      if (job.status === 'running') {
        console.error(`Task #${id} is running, cancel it first.`);
        process.exit(1);
      }
      await deleteJob(job.id);
      console.log(`Task #${id} deleted.`);
    }),
  );

taskCommand
  .command('logs')
  .description('Show logs for a task')
  .argument('<id>', 'Task ID')
  .option('-f, --follow', 'Follow log output')
  .action(
    cliAction(async (id: string, opts: { follow?: boolean }) => {
      getJobOrExit(id);
      const db = getDb();

      const latestRun = db
        .select()
        .from(schema.runs)
        .where(eq(schema.runs.jobId, Number(id)))
        .orderBy(desc(schema.runs.id))
        .get();

      if (!latestRun || !latestRun.logFile) {
        console.log('No logs available.');
        return;
      }

      const logFile = latestRun.logFile;

      if (!fs.existsSync(logFile)) {
        console.log(`Log file not found: ${logFile}`);
        return;
      }

      if (opts.follow) {
        const content = fs.readFileSync(logFile, 'utf-8');
        process.stdout.write(content);

        let position = fs.statSync(logFile).size;
        let cleaned = false;

        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          fs.unwatchFile(logFile);
        };

        fs.watchFile(logFile, { interval: LOG_WATCH_INTERVAL_MS }, () => {
          try {
            const stat = fs.statSync(logFile);
            if (stat.size > position) {
              const fd = fs.openSync(logFile, 'r');
              try {
                const buffer = Buffer.alloc(stat.size - position);
                fs.readSync(fd, buffer, 0, buffer.length, position);
                process.stdout.write(buffer.toString());
                position = stat.size;
              } finally {
                fs.closeSync(fd);
              }
            }
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              cleanup();
            }
          }
        });

        const onSignal = () => {
          cleanup();
          process.exit(0);
        };

        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);

        await new Promise(() => {});
      } else {
        const content = fs.readFileSync(logFile, 'utf-8');
        console.log(content);
      }
    }),
  );
