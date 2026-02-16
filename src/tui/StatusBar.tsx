import path from 'node:path';
import { Box, Text } from 'ink';
import type React from 'react';
import type { JuniorData } from './hooks.js';

const folderName = path.basename(process.cwd());

type Props = {
  data: JuniorData;
  hints: React.ReactNode;
  message: string;
  width: number;
};

export function StatusBar({ data, hints, message, width }: Props) {
  const { daemon, counts } = data;

  const left = (
    <>
      <Text bold>{folderName}</Text>
      <Text> </Text>
      {daemon.running ? <Text color="green">●</Text> : <Text color="red">○</Text>}
      <Text> </Text>
      <Text color="yellow">Q:{counts.queued}</Text>
      <Text> </Text>
      <Text color="cyan">R:{counts.running}</Text>
      <Text> </Text>
      <Text color="green">D:{counts.done}</Text>
      <Text> </Text>
      <Text color="red">F:{counts.failed}</Text>
      {data.schedules.length > 0 && (
        <>
          <Text> </Text>
          <Text dimColor>S:{data.schedules.length}</Text>
        </>
      )}
    </>
  );

  const right = message ? <Text color="green">{message}</Text> : width >= 60 ? <Text dimColor>{hints}</Text> : null;

  return (
    <Box paddingX={1} height={1} justifyContent="space-between" width={width}>
      <Text>{left}</Text>
      {right}
    </Box>
  );
}
