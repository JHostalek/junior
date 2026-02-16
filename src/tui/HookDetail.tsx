import { desc, eq } from 'drizzle-orm';
import { Box, Text } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { TASK_LIST_LIMIT, TUI_FALLBACK_POLL_MS } from '@/core/constants.js';
import { watchChanges } from '@/core/events.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import type { Hook, Job } from './hooks.js';
import { TaskList } from './TaskList.js';

interface Props {
  hook: Hook;
  jobCursor: number;
  height: number;
  width: number;
  onJobCountChange: (count: number) => void;
}

export function useHookJobs(hookId: number | null): Job[] {
  const [jobs, setJobs] = useState<Job[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (hookId === null) {
      setJobs([]);
      return;
    }

    if (!initialized.current) {
      ensureInit();
      initialized.current = true;
    }

    const id = hookId;
    function refresh() {
      const db = getDb();
      const result = db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.hookId, id))
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
  }, [hookId]);

  return jobs;
}

function formatLastChecked(hook: Hook): string {
  if (!hook.lastCheckedAt) return 'never';
  return new Date(hook.lastCheckedAt * 1000).toLocaleString();
}

function formatLastTriggered(hook: Hook): string {
  if (!hook.lastTriggeredAt) return 'never';
  return new Date(hook.lastTriggeredAt * 1000).toLocaleString();
}

export function HookDetail({ hook, jobCursor, height, width, onJobCountChange }: Props) {
  const jobs = useHookJobs(hook.id);

  useEffect(() => {
    onJobCountChange(jobs.length);
  }, [jobs.length, onJobCountChange]);

  const status = hook.paused ? 'paused' : 'active';
  const promptFirstLine = hook.prompt.split('\n')[0] || '\u2014';
  const headerHeight = 4;
  const listHeight = Math.max(height - headerHeight, 1);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text wrap="truncate">
          <Text dimColor>hook #{hook.id} | </Text>
          <Text color={status === 'active' ? 'green' : 'gray'}>{status}</Text>
          <Text dimColor> | </Text>
          <Text>{hook.name}</Text>
        </Text>
      </Box>
      <Box>
        <Text wrap="truncate" dimColor>
          prompt: <Text>{promptFirstLine}</Text>
        </Text>
      </Box>
      <Box>
        <Text wrap="truncate" dimColor>
          last checked: <Text>{formatLastChecked(hook)}</Text>
          {'  '}last triggered: <Text>{formatLastTriggered(hook)}</Text>
        </Text>
      </Box>
      <Box height={listHeight} flexDirection="column">
        <TaskList jobs={jobs} cursor={jobCursor} height={listHeight} width={width} showCursor={true} />
      </Box>
    </Box>
  );
}
