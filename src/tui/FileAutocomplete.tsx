import chalk from 'chalk';
import { Box, Text, useInput } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/core/errors.js';
import { listTrackedFiles } from '@/core/git.js';
import { info } from '@/core/logger.js';

interface Props {
  query: string;
  repoPath: string;
  onSelect: (filePath: string) => void;
  isActive: boolean;
  maxVisible?: number;
  width?: number;
}

export function FileAutocomplete({ query, repoPath, onSelect, isActive, maxVisible = 8, width }: Props) {
  const filesRef = useRef<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    listTrackedFiles(repoPath)
      .then((files) => {
        filesRef.current = files;
        setLoaded(true);
      })
      .catch((err) => {
        info('Failed to list tracked files for autocomplete', { error: errorMessage(err) });
        filesRef.current = [];
        setLoaded(true);
      });
  }, [repoPath]);

  const lowerQuery = query.toLowerCase();
  const matches = loaded ? filesRef.current.filter((f) => f.toLowerCase().includes(lowerQuery)).slice(0, 100) : [];

  useEffect(() => {
    setCursor(0);
  }, []);

  const clampedCursor = Math.min(cursor, Math.max(0, matches.length - 1));

  useInput(
    (_input, key) => {
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
          onSelect(matches[clampedCursor]);
        }
        return;
      }
    },
    { isActive },
  );

  if (!loaded || matches.length === 0) return null;

  const start = Math.max(0, clampedCursor - Math.floor(maxVisible / 2));
  const visible = matches.slice(start, start + maxVisible);

  return (
    <Box flexDirection="column" width={width}>
      {visible.map((file, i) => {
        const idx = start + i;
        const display = idx === clampedCursor ? chalk.inverse(` ${file} `) : ` ${file} `;
        return (
          <Text key={file} wrap="truncate">
            {display}
          </Text>
        );
      })}
      {matches.length > maxVisible && <Text dimColor> {matches.length} files matched</Text>}
    </Box>
  );
}
