import chalk from 'chalk';
import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

interface Command {
  name: string;
  description: string;
}

const COMMANDS: Command[] = [
  { name: '/tasks', description: 'Switch to task list' },
  { name: '/list', description: 'Switch to task list' },
  { name: '/new-schedule', description: 'Add a schedule' },
  { name: '/schedules', description: 'Switch to schedules' },
  { name: '/daemon-start', description: 'Start the daemon' },
  { name: '/daemon-stop', description: 'Stop the daemon' },
  { name: '/reset-exit', description: 'Ask again on exit (undo remember)' },
  { name: '/quit', description: 'Exit app' },
  { name: '/exit', description: 'Exit app' },
  { name: '/q', description: 'Exit app' },
];

interface Props {
  query: string;
  onSelect: (command: string) => void;
  onCancel: () => void;
  isActive: boolean;
  width?: number;
}

export function CommandPicker({ query, onSelect, onCancel, isActive, width }: Props) {
  const [cursor, setCursor] = useState(0);

  const lowerQuery = query.toLowerCase();
  const matches = COMMANDS.filter((c) => c.name.slice(1).toLowerCase().includes(lowerQuery));

  useEffect(() => {
    setCursor(0);
  }, []);

  const clampedCursor = Math.min(cursor, Math.max(0, matches.length - 1));

  useInput(
    (_input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(matches.length - 1, c + 1));
        return;
      }
      if (key.return || key.tab) {
        if (matches.length > 0 && matches[clampedCursor]) {
          onSelect(matches[clampedCursor].name);
        }
        return;
      }
    },
    { isActive },
  );

  if (matches.length === 0) return null;

  return (
    <Box flexDirection="column" width={width}>
      {matches.map((cmd, i) => {
        const selected = i === clampedCursor;
        const display = selected
          ? chalk.inverse(` ${cmd.name} `) + chalk.dim(` ${cmd.description}`)
          : ` ${cmd.name} ${chalk.dim(` ${cmd.description}`)}`;
        return (
          <Text key={cmd.name} wrap="truncate">
            {display}
          </Text>
        );
      })}
    </Box>
  );
}
