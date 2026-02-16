import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

interface ExitDialogProps {
  onConfirm: (choice: 'stop' | 'keep', remember: boolean) => void;
  onCancel: () => void;
  onRememberChange: (remember: boolean) => void;
}

export function ExitDialog({ onConfirm, onCancel, onRememberChange }: ExitDialogProps) {
  const [selected, setSelected] = useState(0);
  const [remember, setRemember] = useState(false);

  const options = ['stop daemon', 'keep running in background'] as const;
  const choices: ('stop' | 'keep')[] = ['stop', 'keep'];

  useInput((input, key) => {
    if (key.return) {
      onConfirm(choices[selected], remember);
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow || input === 'k') {
      setSelected((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setSelected((s) => Math.min(options.length - 1, s + 1));
      return;
    }
    if (input === 'r') {
      setRemember((r) => {
        const next = !r;
        onRememberChange(next);
        return next;
      });
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>daemon is running — what should we do?</Text>
      <Box marginTop={1} flexDirection="column">
        {options.map((label, i) => (
          <Text key={label}>
            {i === selected ? <Text color="cyan">{' > '}</Text> : '   '}
            {label}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[{remember ? 'x' : ' '}] remember</Text>
      </Box>
    </Box>
  );
}
