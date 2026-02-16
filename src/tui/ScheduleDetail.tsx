import { desc, eq } from 'drizzle-orm';
import { Box, Text } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { TASK_LIST_LIMIT, TUI_FALLBACK_POLL_MS } from '@/core/constants.js';
import { watchChanges } from '@/core/events.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import type { Job, Schedule } from './hooks.js';
import { TaskList } from './TaskList.js';

interface Props {
  schedule: Schedule;
  jobCursor: number;
  height: number;
  width: number;
  onJobCountChange: (count: number) => void;
}

export function useScheduleJobs(scheduleId: number | null): Job[] {
  const [jobs, setJobs] = useState<Job[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (scheduleId === null) {
      setJobs([]);
      return;
    }

    if (!initialized.current) {
      ensureInit();
      initialized.current = true;
    }

    const id = scheduleId;
    function refresh() {
      const db = getDb();
      const result = db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.scheduleId, id))
        .orderBy(desc(schema.jobs.id))
        .limit(TASK_LIST_LIMIT)
        .all();
      setJobs(result);
    }

    refresh();
    const stopWatching = watchChanges(refresh);
    const fallback = setInterval(refresh, TUI_FALLBACK_POLL_MS);
    return () => {
      stopWatching();
      clearInterval(fallback);
    };
  }, [scheduleId]);

  return jobs;
}

function formatCountdown(schedule: Schedule, now: number): string {
  if (schedule.paused) return '\u2014';
  if (!schedule.nextRunAt) return '\u2014';
  const diffMs = schedule.nextRunAt * 1000 - now;
  if (diffMs < 0) return 'now';
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `${diffS}s`;
  if (diffS < 3600) {
    const m = Math.floor(diffS / 60);
    const s = diffS % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ${Math.floor((diffS % 3600) / 60)}m`;
  return `${Math.floor(diffS / 86400)}d`;
}

function formatLastRun(schedule: Schedule): string {
  if (!schedule.lastRunAt) return '\u2014';
  return new Date(schedule.lastRunAt * 1000).toLocaleString();
}

export function ScheduleDetail({ schedule, jobCursor, height, width, onJobCountChange }: Props) {
  const jobs = useScheduleJobs(schedule.id);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onJobCountChange(jobs.length);
  }, [jobs.length, onJobCountChange]);

  const status = schedule.paused ? 'paused' : 'active';
  const promptFirstLine = schedule.prompt.split('\n')[0] || '\u2014';
  const headerHeight = 4;
  const listHeight = Math.max(height - headerHeight, 1);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text wrap="truncate">
          <Text dimColor>schedule #{schedule.id} | </Text>
          <Text color={status === 'active' ? 'green' : 'gray'}>{status}</Text>
          <Text dimColor> | {schedule.cron} | </Text>
          <Text>{schedule.name}</Text>
        </Text>
      </Box>
      <Box>
        <Text wrap="truncate" dimColor>
          prompt: <Text>{promptFirstLine}</Text>
        </Text>
      </Box>
      <Box>
        <Text wrap="truncate" dimColor>
          next: <Text>{formatCountdown(schedule, now)}</Text>
          {'  '}last: <Text>{formatLastRun(schedule)}</Text>
        </Text>
      </Box>
      <Box height={listHeight} flexDirection="column">
        <TaskList jobs={jobs} cursor={jobCursor} height={listHeight} width={width} showCursor={true} />
      </Box>
    </Box>
  );
}
