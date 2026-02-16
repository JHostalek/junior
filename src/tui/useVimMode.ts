import { useInput } from 'ink';
import { useRef, useState } from 'react';

export type VimMode = 'insert' | 'normal';

interface NormalModeActions {
  itemCount: () => number;
  onDelete?: (index: number) => void;
}

interface VimModeOptions {
  active: boolean;
  actions?: NormalModeActions;
  onModeChange?: (mode: VimMode) => void;
  onUnhandledInput?: (input: string) => void;
}

export function useVimMode(options: VimModeOptions) {
  const [mode, setModeState] = useState<VimMode>('insert');
  const [normalCursor, setNormalCursor] = useState(0);
  const [pendingD, setPendingD] = useState(false);
  const actionsRef = useRef(options.actions);
  actionsRef.current = options.actions;
  const onModeChangeRef = useRef(options.onModeChange);
  onModeChangeRef.current = options.onModeChange;
  const onUnhandledInputRef = useRef(options.onUnhandledInput);
  onUnhandledInputRef.current = options.onUnhandledInput;

  const setMode = (m: VimMode) => {
    setModeState(m);
    if (m === 'normal') setNormalCursor(0);
    if (m === 'insert') setPendingD(false);
    onModeChangeRef.current?.(m);
  };

  useInput(
    (input, key) => {
      if (key.escape || (input === 'i' && !key.ctrl && !key.meta)) {
        setMode('insert');
        return;
      }

      const actions = actionsRef.current;
      const count = actions?.itemCount() ?? 0;

      if (input === 'j' && !key.ctrl && !key.meta) {
        setPendingD(false);
        if (count > 0) setNormalCursor((c) => Math.min(c + 1, count - 1));
        return;
      }

      if (input === 'k' && !key.ctrl && !key.meta) {
        setPendingD(false);
        if (count > 0) setNormalCursor((c) => Math.max(c - 1, 0));
        return;
      }

      if (input === 'x' && !key.ctrl && !key.meta) {
        if (count > 0) actions?.onDelete?.(normalCursor);
        setPendingD(false);
        return;
      }

      if (input === 'd' && !key.ctrl && !key.meta) {
        if (count > 0) {
          if (pendingD) {
            actions?.onDelete?.(normalCursor);
            setPendingD(false);
          } else {
            setPendingD(true);
          }
        }
        return;
      }

      setPendingD(false);
      if (input.length > 0 && !key.ctrl && !key.meta) {
        onUnhandledInputRef.current?.(input);
      }
    },
    { isActive: options.active && mode === 'normal' },
  );

  return { mode, normalCursor, setNormalCursor, setMode };
}
