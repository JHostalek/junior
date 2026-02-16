import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';
import { TextInput } from './TextInput.js';

interface Props {
  width: number;
  onSubmit: (description: string) => void;
  onCancel: () => void;
}

export function AddSchedule({ width, onSubmit, onCancel }: Props) {
  const [description, setDescription] = useState('');

  const handleSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
    },
    [onSubmit],
  );

  const formWidth = Math.min(60, width - 4);

  return (
    <Box flexDirection="column" width={formWidth}>
      <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text dimColor>new schedule — describe what and when</Text>
        <Box marginTop={0}>
          <TextInput
            value={description}
            onChange={setDescription}
            onSubmit={handleSubmit}
            onEscape={onCancel}
            focus={true}
            placeholder="run lint checks every weekday at 9am"
          />
        </Box>
      </Box>
    </Box>
  );
}
