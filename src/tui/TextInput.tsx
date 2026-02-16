import chalk from 'chalk';
import { Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onCtrlV?: () => void;
  onEscape?: () => void;
  focus?: boolean;
  showCursor?: boolean;
  placeholder?: string;
}

export function TextInput({
  value,
  onChange,
  onSubmit,
  onCtrlV,
  onEscape,
  focus = true,
  showCursor = true,
  placeholder = '',
}: Props) {
  const [cursor, setCursor] = useState(value.length);

  useEffect(() => {
    if (cursor > value.length) {
      setCursor(value.length);
    }
  }, [value, cursor]);

  useInput(
    (input, key) => {
      if (key.downArrow || key.upArrow || (key.ctrl && input === 'c') || key.tab) {
        return;
      }

      if (key.escape) {
        onEscape?.();
        return;
      }

      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.ctrl && input === 'u') {
        onChange(value.slice(cursor));
        setCursor(0);
        return;
      }

      if (key.ctrl && input === 'w') {
        const before = value.slice(0, cursor);
        const after = value.slice(cursor);
        const newBefore = deleteWordBack(before);
        onChange(newBefore + after);
        setCursor(newBefore.length);
        return;
      }

      if (key.ctrl && input === 'a') {
        setCursor(0);
        return;
      }

      if (key.ctrl && input === 'e') {
        setCursor(value.length);
        return;
      }

      if (key.ctrl && input === 'k') {
        onChange(value.slice(0, cursor));
        return;
      }

      if (key.leftArrow) {
        if (key.meta || key.ctrl) {
          setCursor(wordBoundaryLeft(value, cursor));
        } else {
          setCursor(Math.max(0, cursor - 1));
        }
        return;
      }

      if (key.rightArrow) {
        if (key.meta || key.ctrl) {
          setCursor(wordBoundaryRight(value, cursor));
        } else {
          setCursor(Math.min(value.length, cursor + 1));
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursor === 0) return;

        if (key.meta) {
          onChange(value.slice(cursor));
          setCursor(0);
          return;
        }

        const before = value.slice(0, cursor);
        const after = value.slice(cursor);

        if (input === '\x17') {
          const newBefore = deleteWordBack(before);
          onChange(newBefore + after);
          setCursor(newBefore.length);
          return;
        }

        onChange(before.slice(0, -1) + after);
        setCursor(cursor - 1);
        return;
      }

      if (key.ctrl && input === 'v') {
        onCtrlV?.();
        return;
      }

      if (key.ctrl) {
        return;
      }

      if (input === '\x1B\x7F' || input === '\x1Bd') {
        const before = value.slice(0, cursor);
        const after = value.slice(cursor);
        const newBefore = deleteWordBack(before);
        onChange(newBefore + after);
        setCursor(newBefore.length);
        return;
      }

      if (input.length > 0 && input >= ' ') {
        const clean = input.replace(/[\r\n\t]/g, ' ').replace(/ {2,}/g, ' ');
        if (clean.length === 0) return;
        const next = value.slice(0, cursor) + clean + value.slice(cursor);
        onChange(next);
        setCursor(cursor + clean.length);
      }
    },
    { isActive: focus },
  );

  let rendered: string;
  if (value.length === 0) {
    if (!showCursor) {
      rendered = placeholder ? chalk.gray(placeholder) : '';
    } else {
      rendered = placeholder ? chalk.inverse(placeholder[0]) + chalk.gray(placeholder.slice(1)) : chalk.inverse(' ');
    }
  } else {
    rendered = '';
    for (let i = 0; i < value.length; i++) {
      rendered += showCursor && i === cursor ? chalk.inverse(value[i]!) : value[i];
    }
    if (showCursor && cursor === value.length) {
      rendered += chalk.inverse(' ');
    }
  }

  return <Text wrap="wrap">{rendered}</Text>;
}

function deleteWordBack(s: string): string {
  return s.replace(/\s*\S+\s*$/, '');
}

function wordBoundaryLeft(s: string, pos: number): number {
  if (pos === 0) return 0;
  let i = pos - 1;
  while (i > 0 && s[i - 1] === ' ') i--;
  while (i > 0 && s[i - 1] !== ' ') i--;
  return i;
}

function wordBoundaryRight(s: string, pos: number): number {
  if (pos >= s.length) return s.length;
  let i = pos;
  while (i < s.length && s[i] !== ' ') i++;
  while (i < s.length && s[i] === ' ') i++;
  return i;
}
