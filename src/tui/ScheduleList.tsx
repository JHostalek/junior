import chalk from 'chalk';
import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import type { Schedule } from './hooks.js';

const STATUS_COLORS: Record<string, (s: string) => string> = {
  active: chalk.green,
  paused: chalk.gray,
};

const STATUS_COLORS_INK: Record<string, string> = {
  active: 'green',
  paused: 'gray',
};

export function ScheduleList({
  schedules,
  cursor,
  height,
  width,
  showCursor = true,
}: {
  schedules: Schedule[];
  cursor: number;
  height: number;
  width: number;
  showCursor?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const listHeight = Math.max(height - 1, 1);
  let start = 0;
  if (cursor >= start + listHeight) {
    start = cursor - listHeight + 1;
  }
  const visible = schedules.slice(start, start + listHeight);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text dimColor wrap="truncate">
          {pad('#', 5)}
          {pad('status', 12)}
          {pad('cron', 18)}
          {pad('next run', 15)}
          {'name'}
        </Text>
      </Box>
      {schedules.length === 0 && (
        <Box justifyContent="center" flexGrow={1}>
          <Text dimColor>No schedules yet</Text>
        </Box>
      )}
      {visible.map((schedule, i) => {
        const idx = start + i;
        const selected = idx === cursor;
        const status = schedule.paused ? 'paused' : 'active';
        const colorFn = STATUS_COLORS[status] || ((s: string) => s);

        const idPart = pad(String(schedule.id), 5);
        const statusPart = pad(status, 12);
        const cronPart = pad(schedule.cron, 18);
        const nextRunPart = pad(formatNextRun(schedule, now), 15);

        if (selected && showCursor) {
          const line = chalk.inverse(idPart + colorFn(statusPart) + cronPart + nextRunPart + schedule.name);
          return (
            <Box key={schedule.id}>
              <Text wrap="truncate">{line}</Text>
            </Box>
          );
        }

        return (
          <Box key={schedule.id}>
            <Text wrap="truncate">
              {idPart}
              <Text color={STATUS_COLORS_INK[status] || 'white'}>{statusPart}</Text>
              {cronPart}
              <Text dimColor>{nextRunPart}</Text>
              {schedule.name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function formatNextRun(schedule: Schedule, now: number): string {
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
