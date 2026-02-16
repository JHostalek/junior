import { desc, eq, sql } from 'drizzle-orm';
import { useEffect, useRef, useState } from 'react';
import { TASK_LIST_LIMIT, TUI_FALLBACK_POLL_MS } from '@/core/constants.js';
import { watchChanges } from '@/core/events.js';
import { isDaemonRunning } from '@/daemon/pid.js';
import { ensureInit, getDb, schema } from '@/db/index.js';

export type Job = typeof schema.jobs.$inferSelect;
export type Run = typeof schema.runs.$inferSelect;
export type Schedule = typeof schema.schedules.$inferSelect;
export type Hook = typeof schema.hooks.$inferSelect;

interface DaemonInfo {
  running: boolean;
  pid: number | null;
}

export interface JobCounts {
  queued: number;
  running: number;
  done: number;
  failed: number;
}

export interface JuniorData {
  daemon: DaemonInfo;
  counts: JobCounts;
  jobs: Job[];
  schedules: Schedule[];
  hooks: Hook[];
}

export function useJuniorData(filter: string | null) {
  const [data, setData] = useState<JuniorData>({
    daemon: { running: false, pid: null },
    counts: { queued: 0, running: 0, done: 0, failed: 0 },
    jobs: [],
    schedules: [],
    hooks: [],
  });
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      ensureInit();
      initialized.current = true;
    }

    function refresh() {
      const db = getDb();
      const daemon = isDaemonRunning();

      const countRows = db
        .select({ status: schema.jobs.status, count: sql<number>`count(*)` })
        .from(schema.jobs)
        .groupBy(schema.jobs.status)
        .all();

      const counts: JobCounts = { queued: 0, running: 0, done: 0, failed: 0 };
      for (const row of countRows) {
        if (row.status in counts) {
          counts[row.status as keyof JobCounts] = row.count;
        }
      }

      const query = db.select().from(schema.jobs).orderBy(desc(schema.jobs.id)).limit(TASK_LIST_LIMIT);
      const jobs = filter ? query.where(eq(schema.jobs.status, filter)).all() : query.all();

      const schedules = db.select().from(schema.schedules).all();
      const hooks = db.select().from(schema.hooks).all();

      setData({ daemon, counts, jobs, schedules, hooks });
    }

    refresh();
    const stopWatching = watchChanges(refresh);
    const fallback = setInterval(refresh, TUI_FALLBACK_POLL_MS);
    return () => {
      stopWatching();
      clearInterval(fallback);
    };
  }, [filter]);

  return data;
}
