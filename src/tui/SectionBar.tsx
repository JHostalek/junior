import { Box, Text } from 'ink';

type View =
  | 'input'
  | 'list'
  | 'detail'
  | 'schedules'
  | 'scheduleDetail'
  | 'addSchedule'
  | 'editSchedule'
  | 'hooks'
  | 'hookDetail'
  | 'addHook'
  | 'editHook'
  | 'exiting';

const SECTIONS = [
  { key: '1', id: 'input', label: 'input' },
  { key: '2', id: 'list', label: 'tasks' },
  { key: '3', id: 'schedules', label: 'schedules' },
  { key: '4', id: 'hooks', label: 'hooks' },
] as const;

type Props = {
  activeView: View;
  width: number;
};

export function SectionBar({ activeView, width }: Props) {
  return (
    <Box paddingX={1} height={1} width={width}>
      {SECTIONS.map((section, i) => {
        const active = activeView === section.id;
        return (
          <Text key={section.id} bold={active} dimColor={!active}>
            {section.key}:{section.label}
            {i < SECTIONS.length - 1 ? '  ' : ''}
          </Text>
        );
      })}
    </Box>
  );
}
