import chalk from 'chalk';
import { Box, Text } from 'ink';
import type { Hook } from './hooks.js';

const STATUS_COLORS: Record<string, (s: string) => string> = {
  active: chalk.green,
  paused: chalk.gray,
};

const STATUS_COLORS_INK: Record<string, string> = {
  active: 'green',
  paused: 'gray',
};

export function HookList({
  hooks,
  cursor,
  height,
  width,
  showCursor = true,
}: {
  hooks: Hook[];
  cursor: number;
  height: number;
  width: number;
  showCursor?: boolean;
}) {
  const listHeight = Math.max(height - 1, 1);
  let start = 0;
  if (cursor >= start + listHeight) {
    start = cursor - listHeight + 1;
  }
  const visible = hooks.slice(start, start + listHeight);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text dimColor wrap="truncate">
          {pad('#', 5)}
          {pad('status', 12)}
          {pad('last checked', 22)}
          {'name'}
        </Text>
      </Box>
      {hooks.length === 0 && (
        <Box justifyContent="center" flexGrow={1}>
          <Text dimColor>No hooks yet</Text>
        </Box>
      )}
      {visible.map((hook, i) => {
        const idx = start + i;
        const selected = idx === cursor;
        const status = hook.paused ? 'paused' : 'active';
        const colorFn = STATUS_COLORS[status] || ((s: string) => s);

        const idPart = pad(String(hook.id), 5);
        const statusPart = pad(status, 12);
        const lastCheckedPart = pad(formatLastChecked(hook), 22);

        if (selected && showCursor) {
          const line = chalk.inverse(idPart + colorFn(statusPart) + lastCheckedPart + hook.name);
          return (
            <Box key={hook.id}>
              <Text wrap="truncate">{line}</Text>
            </Box>
          );
        }

        return (
          <Box key={hook.id}>
            <Text wrap="truncate">
              {idPart}
              <Text color={STATUS_COLORS_INK[status] || 'white'}>{statusPart}</Text>
              <Text dimColor>{lastCheckedPart}</Text>
              {hook.name}
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

function formatLastChecked(hook: Hook): string {
  if (hook.paused) return '\u2014';
  if (!hook.lastCheckedAt) return 'never';
  const diffS = Math.floor((Date.now() - hook.lastCheckedAt * 1000) / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}
