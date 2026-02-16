import { Text } from 'ink';
import type React from 'react';
import type { VimMode } from './useVimMode.js';

type View = 'input' | 'list' | 'detail' | 'schedules' | 'scheduleDetail' | 'addSchedule' | 'editSchedule' | 'exiting';

const FILTER_LABELS = ['all', 'queued', 'running', 'failed', 'done'];

export function buildHints(
  view: View,
  filterIdx: number,
  exitRemember: boolean,
  inputMode: VimMode = 'insert',
  deleteConfirm: number | null = null,
  visualMode = false,
  batchDeleteConfirm: number[] | null = null,
  schedDeleteConfirm: number | null = null,
): React.ReactNode {
  if (view === 'exiting') {
    return (
      <>
        <Text dimColor>j/k</Text>
        <Text>:select </Text>
        <Text dimColor>r</Text>
        <Text>:remember{exitRemember ? '(on)' : ''} </Text>
        <Text dimColor>enter</Text>
        <Text>:confirm </Text>
        <Text dimColor>esc</Text>
        <Text>:cancel</Text>
      </>
    );
  }
  if (view === 'input') {
    return inputMode === 'normal' ? (
      <>
        <Text dimColor>i</Text>
        <Text>:insert </Text>
        <Text dimColor>j/k</Text>
        <Text>:nav </Text>
        <Text dimColor>dd/x</Text>
        <Text>:delete </Text>
        <Text dimColor>tab</Text>
        <Text>:tasks </Text>
        <Text dimColor>ctrl+c</Text>
        <Text>:quit</Text>
      </>
    ) : (
      <>
        <Text dimColor>esc</Text>
        <Text>:normal </Text>
        <Text dimColor>tab</Text>
        <Text>:tasks </Text>
        <Text dimColor>ctrl+c</Text>
        <Text>:quit</Text>
      </>
    );
  }
  if (view === 'detail') {
    return (
      <>
        <Text dimColor>j/k</Text>
        <Text>:scroll </Text>
        <Text dimColor>g/G</Text>
        <Text>:top/end </Text>
        <Text dimColor>w</Text>
        <Text>:wrap </Text>
        <Text dimColor>esc</Text>
        <Text>:back</Text>
      </>
    );
  }
  if (view === 'addSchedule') {
    return (
      <>
        <Text dimColor>enter</Text>
        <Text>:submit </Text>
        <Text dimColor>esc</Text>
        <Text>:back</Text>
      </>
    );
  }
  if (view === 'editSchedule') {
    return (
      <>
        <Text dimColor>enter</Text>
        <Text>:next </Text>
        <Text dimColor>esc</Text>
        <Text>:back </Text>
        <Text dimColor>ctrl+c</Text>
        <Text>:cancel</Text>
      </>
    );
  }
  if (view === 'scheduleDetail') {
    if (deleteConfirm !== null) {
      return (
        <>
          <Text color="red" bold>
            delete #{deleteConfirm}?{' '}
          </Text>
          <Text dimColor>y</Text>
          <Text>:yes </Text>
          <Text dimColor>any</Text>
          <Text>:no</Text>
        </>
      );
    }
    return (
      <>
        <Text dimColor>enter</Text>
        <Text>:open </Text>
        <Text dimColor>j/k</Text>
        <Text>:nav </Text>
        <Text dimColor>e</Text>
        <Text>:edit </Text>
        <Text dimColor>dd</Text>
        <Text>:delete </Text>
        <Text dimColor>c</Text>
        <Text>:cancel </Text>
        <Text dimColor>r</Text>
        <Text>:retry </Text>
        <Text dimColor>l</Text>
        <Text>:logs </Text>
        <Text dimColor>esc</Text>
        <Text>:back</Text>
      </>
    );
  }
  if (view === 'schedules') {
    if (schedDeleteConfirm !== null) {
      return (
        <>
          <Text color="red" bold>
            delete schedule #{schedDeleteConfirm}?{' '}
          </Text>
          <Text dimColor>y</Text>
          <Text>:yes </Text>
          <Text dimColor>any</Text>
          <Text>:no</Text>
        </>
      );
    }
    return (
      <>
        <Text dimColor>enter</Text>
        <Text>:open </Text>
        <Text dimColor>j/k</Text>
        <Text>:nav </Text>
        <Text dimColor>e</Text>
        <Text>:edit </Text>
        <Text dimColor>p</Text>
        <Text>:pause </Text>
        <Text dimColor>dd</Text>
        <Text>:delete </Text>
        <Text dimColor>esc/s</Text>
        <Text>:back</Text>
      </>
    );
  }
  if (batchDeleteConfirm !== null) {
    return (
      <>
        <Text color="red" bold>
          delete {batchDeleteConfirm.length} tasks?{' '}
        </Text>
        <Text dimColor>y</Text>
        <Text>:yes </Text>
        <Text dimColor>any</Text>
        <Text>:no</Text>
      </>
    );
  }
  if (visualMode) {
    return (
      <>
        <Text color="yellow" bold>
          VISUAL{' '}
        </Text>
        <Text dimColor>d</Text>
        <Text>:delete </Text>
        <Text dimColor>c</Text>
        <Text>:cancel </Text>
        <Text dimColor>r</Text>
        <Text>:retry </Text>
        <Text dimColor>j/k</Text>
        <Text>:select </Text>
        <Text dimColor>esc</Text>
        <Text>:exit</Text>
      </>
    );
  }
  if (deleteConfirm !== null) {
    return (
      <>
        <Text color="red" bold>
          delete #{deleteConfirm}?{' '}
        </Text>
        <Text dimColor>y</Text>
        <Text>:yes </Text>
        <Text dimColor>any</Text>
        <Text>:no</Text>
      </>
    );
  }
  return (
    <>
      <Text dimColor>enter</Text>
      <Text>:open </Text>
      <Text dimColor>j/k</Text>
      <Text>:nav </Text>
      <Text dimColor>v</Text>
      <Text>:visual </Text>
      <Text dimColor>dd</Text>
      <Text>:delete </Text>
      <Text dimColor>c</Text>
      <Text>:cancel </Text>
      <Text dimColor>r</Text>
      <Text>:retry </Text>
      <Text dimColor>l</Text>
      <Text>:logs </Text>
      <Text dimColor>f</Text>
      <Text>:{FILTER_LABELS[filterIdx]} </Text>
      <Text dimColor>s</Text>
      <Text>:schedules </Text>
      <Text dimColor>esc/tab</Text>
      <Text>:back</Text>
    </>
  );
}
