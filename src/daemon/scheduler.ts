import { Cron, type CronOptions } from 'croner';
import { eq, sql } from 'drizzle-orm';
import { errorMessage } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import { getDefaultBranch } from '@/core/git.js';
import { info, error as logError } from '@/core/logger.js';
import { getRepoPath } from '@/core/paths.js';
import { getDb, schema } from '@/db/index.js';

const cronJobs = new Map<number, Cron>();

function createCronJob(schedule: typeof schema.schedules.$inferSelect): Cron {
  const options: CronOptions = { name: `schedule-${schedule.id}` };

  const job = new Cron(schedule.cron, options, async () => {
    try {
      info('Schedule triggered', { scheduleId: schedule.id, name: schedule.name });

      const db = getDb();
      const repoPath = getRepoPath();
      const baseBranch = await getDefaultBranch(repoPath);

      db.insert(schema.jobs)
        .values({
          title: schedule.name,
          prompt: schedule.prompt,
          repoPath,
          baseBranch,
          scheduleId: schedule.id,
        })
        .run();

      const nextRun = job.nextRun();
      db.update(schema.schedules)
        .set({
          lastRunAt: sql`(unixepoch())`,
          nextRunAt: nextRun ? Math.floor(nextRun.getTime() / 1000) : null,
        })
        .where(eq(schema.schedules.id, schedule.id))
        .run();

      notifyChange();
    } catch (err) {
      logError('Failed to create job from schedule', {
        scheduleId: schedule.id,
        error: errorMessage(err),
      });
    }
  });

  return job;
}

export function loadSchedules(): void {
  const db = getDb();
  const activeSchedules = db.select().from(schema.schedules).where(eq(schema.schedules.paused, 0)).all();

  const activeIds = new Set(activeSchedules.map((s) => s.id));

  for (const [id, job] of cronJobs) {
    if (!activeIds.has(id)) {
      job.stop();
      cronJobs.delete(id);
    }
  }

  for (const schedule of activeSchedules) {
    if (cronJobs.has(schedule.id)) continue;
    try {
      const job = createCronJob(schedule);
      cronJobs.set(schedule.id, job);

      const nextRun = job.nextRun();
      if (nextRun) {
        try {
          db.update(schema.schedules)
            .set({ nextRunAt: Math.floor(nextRun.getTime() / 1000) })
            .where(eq(schema.schedules.id, schedule.id))
            .run();
        } catch (dbErr) {
          logError('Failed to update nextRunAt for schedule', {
            id: schedule.id,
            error: errorMessage(dbErr),
          });
        }
      }
    } catch (err) {
      logError('Failed to load schedule', {
        id: schedule.id,
        error: errorMessage(err),
      });
    }
  }

  info('Schedules loaded', { count: activeSchedules.length });
}

export function stopAll(): void {
  for (const [id, job] of cronJobs) {
    job.stop();
    cronJobs.delete(id);
  }
  info('All schedules stopped');
}
