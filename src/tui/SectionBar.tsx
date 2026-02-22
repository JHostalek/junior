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
  { id: 'input', label: 'input' },
  { id: 'list', label: 'tasks' },
  { id: 'schedules', label: 'schedules' },
  { id: 'hooks', label: 'hooks' },
] as const;

const MCP_SECTIONS = new Set<string>(['schedules', 'hooks']);

type Props = {
  activeView: View;
  width: number;
  mcpAvailable?: boolean;
};

export function SectionBar({ activeView, width, mcpAvailable = true }: Props) {
  return (
    <Box paddingX={1} height={1} width={width}>
      {SECTIONS.map((section, i) => {
        const active = activeView === section.id;
        const suffix = !mcpAvailable && MCP_SECTIONS.has(section.id) ? '*' : '';
        return (
          <Text key={section.id} bold={active} dimColor={!active}>
            {section.label}
            {suffix}
            {i < SECTIONS.length - 1 ? '  ' : ''}
          </Text>
        );
      })}
      {!mcpAvailable && <Text dimColor> (*no MCP)</Text>}
    </Box>
  );
}
