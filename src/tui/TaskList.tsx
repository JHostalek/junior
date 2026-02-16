import chalk from 'chalk';
import { Box, Text } from 'ink';
import type { Job } from './hooks.js';

const STATUS_COLORS: Record<string, (s: string) => string> = {
  queued: chalk.yellow,
  running: chalk.cyan,
  done: chalk.green,
  failed: chalk.red,
  cancelled: chalk.gray,
};

export function TaskList({
  jobs,
  cursor,
  height,
  width,
  showCursor = true,
  selectedRange = null,
}: {
  jobs: Job[];
  cursor: number;
  height: number;
  width: number;
  showCursor?: boolean;
  selectedRange?: [number, number] | null;
}) {
  const listHeight = Math.max(height - 1, 1);
  let start = 0;
  if (cursor >= start + listHeight) {
    start = cursor - listHeight + 1;
  }
  const visible = jobs.slice(start, start + listHeight);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text dimColor wrap="truncate">
          {pad('#', 5)}
          {pad('status', 12)}
          {pad('created', 10)}
          {'title'}
        </Text>
      </Box>
      {jobs.length === 0 && (
        <Box justifyContent="center" flexGrow={1}>
          <Text dimColor>No tasks yet</Text>
        </Box>
      )}
      {visible.map((job, i) => {
        const idx = start + i;
        const selected = idx === cursor;
        const colorFn = STATUS_COLORS[job.status] || ((s: string) => s);

        const idPart = pad(String(job.id), 5);
        const statusPart = pad(job.status, 12);
        const timePart = pad(timeAgo(job.createdAt), 10);
        const displayTitle = job.prompt.replace(/\n/g, ' ');

        const inRange = selectedRange !== null && idx >= selectedRange[0] && idx <= selectedRange[1];

        if (selected && showCursor) {
          const line = chalk.inverse(idPart + colorFn(statusPart) + timePart + displayTitle);
          return (
            <Box key={job.id}>
              <Text wrap="truncate">{line}</Text>
            </Box>
          );
        }

        if (inRange) {
          const line = chalk.bgBlue.white(idPart + colorFn(statusPart) + timePart + displayTitle);
          return (
            <Box key={job.id}>
              <Text wrap="truncate">{line}</Text>
            </Box>
          );
        }

        return (
          <Box key={job.id}>
            <Text wrap="truncate">
              {idPart}
              <Text color={STATUS_COLORS_INK[job.status] || 'white'}>{statusPart}</Text>
              {timePart}
              {displayTitle}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

const STATUS_COLORS_INK: Record<string, string> = {
  queued: 'yellow',
  running: 'cyan',
  done: 'green',
  failed: 'red',
  cancelled: 'gray',
};

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
