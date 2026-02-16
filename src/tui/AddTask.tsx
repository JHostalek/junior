import crypto from 'node:crypto';
import path from 'node:path';
import { Box, Text } from 'ink';
import { useCallback, useRef, useState } from 'react';
import { getAttachmentsDir } from '@/core/paths.js';
import { CommandPicker } from './CommandPicker.js';
import { FileAutocomplete } from './FileAutocomplete.js';
import { TextInput } from './TextInput.js';
import { useVimMode, type VimMode } from './useVimMode.js';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onSlashCommand?: (cmd: string) => boolean;
  onModeChange?: (mode: VimMode) => void;
  repoPath: string;
  width: number;
  focus?: boolean;
}

const IMAGE_PATH_RE = /(?:^|\s)(\/\S+\.(?:png|jpg|jpeg|gif|webp|bmp|svg|tiff?))(\s*)$/i;

function getAtQuery(value: string): string | null {
  const lastAt = value.lastIndexOf('@');
  if (lastAt === -1) return null;
  const after = value.slice(lastAt + 1);
  if (after.includes(' ')) return null;
  return after;
}

function getSlashQuery(value: string): string | null {
  if (!value.startsWith('/')) return null;
  if (value.includes(' ')) return null;
  return value.slice(1);
}

async function saveClipboardImage(): Promise<string | null> {
  const dir = getAttachmentsDir();
  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.png`;
  const filePath = path.join(dir, name);

  if (process.platform === 'darwin') {
    const safeFilePath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = [
      `set f to (open for access POSIX file "${safeFilePath}" with write permission)`,
      'write (the clipboard as «class PNGf») to f',
      'close access f',
    ].join('\n');
    const proc = Bun.spawn(['osascript', '-e', script], { stdout: 'ignore', stderr: 'ignore' });
    const exitCode = await proc.exited;
    return exitCode === 0 ? filePath : null;
  }

  if (process.platform === 'linux') {
    const proc = Bun.spawn(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-o'], {
      stdout: Bun.file(filePath),
      stderr: 'ignore',
    });
    const exitCode = await proc.exited;
    return exitCode === 0 ? filePath : null;
  }

  if (process.platform === 'win32') {
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) { $img.Save('${filePath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png) } else { exit 1 }`;
    const proc = Bun.spawn(['powershell', '-NoProfile', '-Command', psScript], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const exitCode = await proc.exited;
    return exitCode === 0 ? filePath : null;
  }

  return null;
}

function wrapLineCount(text: string, lineWidth: number): number {
  if (lineWidth <= 0) return 1;
  if (!text) return 1;
  const len = text.length + 1;
  return Math.max(1, Math.ceil(len / lineWidth));
}

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

export function AddTask({
  value,
  onChange,
  onSubmit,
  onSlashCommand,
  onModeChange,
  repoPath,
  width,
  focus = true,
  maxHeight,
}: Props & { maxHeight?: number }) {
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const slashQuery = getSlashQuery(value);
  const showCommandPicker = slashQuery !== null;
  const atQuery = showCommandPicker ? null : getAtQuery(value);
  const showAutocomplete = atQuery !== null;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const setNormalCursorRef = useRef<(c: number) => void>(undefined);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setNormalCursorRef.current?.(next.length === 0 ? 0 : Math.min(index, next.length - 1));
      return next;
    });
  }, []);

  const dropBuffer = useRef('');
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUnhandledInput = useCallback((input: string) => {
    dropBuffer.current += input;
    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(() => {
      const buf = dropBuffer.current;
      dropBuffer.current = '';
      dropTimer.current = null;
      const match = buf.match(IMAGE_PATH_RE);
      if (match) {
        setAttachments((prev) => [...prev, match[1]!]);
      }
    }, 50);
  }, []);

  const vim = useVimMode({
    active: focus && !showAutocomplete && !showCommandPicker,
    actions: {
      itemCount: () => attachmentsRef.current.length,
      onDelete: removeAttachment,
    },
    onModeChange,
    onUnhandledInput: handleUnhandledInput,
  });
  setNormalCursorRef.current = vim.setNormalCursor;

  const handleChange = useCallback(
    (newValue: string) => {
      const match = newValue.match(IMAGE_PATH_RE);
      if (match) {
        const imgPath = match[1]!;
        const prefix = newValue.slice(0, match.index! + (match[0]?.startsWith('/') ? 0 : 1));
        setAttachments((prev) => [...prev, imgPath]);
        onChange(prefix.trimEnd());
        return;
      }
      onChange(newValue);
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (filePath: string) => {
      const lastAt = value.lastIndexOf('@');
      const before = value.slice(0, lastAt);
      onChange(`${before + filePath} `);
    },
    [value, onChange],
  );

  const handleAutocompleteCancel = useCallback(() => {
    const lastAt = value.lastIndexOf('@');
    const before = value.slice(0, lastAt);
    onChange(before);
  }, [value, onChange]);

  const handleCommandSelect = useCallback(
    (command: string) => {
      onChange(command);
      if (onSlashCommand?.(command)) {
        onChange('');
      }
    },
    [onChange, onSlashCommand],
  );

  const handleCommandCancel = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleCtrlV = useCallback(() => {
    if (pasting) return;
    setPasting(true);
    saveClipboardImage().then((saved) => {
      setPasting(false);
      if (saved) {
        setAttachments((prev) => [...prev, saved]);
      }
    });
  }, [pasting]);

  const handleSubmit = useCallback(
    (val: string) => {
      if (showAutocomplete || showCommandPicker) return;
      let prompt = val.trim();
      if (prompt.startsWith('/') && attachmentsRef.current.length === 0) {
        if (onSlashCommand?.(prompt)) {
          onChange('');
          return;
        }
      }
      if (!prompt && attachmentsRef.current.length === 0) {
        onSubmit('');
        return;
      }
      for (const att of attachmentsRef.current) {
        prompt += `\n\n[Attached image: ${att}]`;
      }
      setAttachments([]);
      vim.setMode('insert');
      onSubmit(prompt);
    },
    [showAutocomplete, onSubmit, onSlashCommand, onChange, showCommandPicker, vim.setMode],
  );

  const isInsert = vim.mode === 'insert';
  const inputFocused = focus && isInsert;

  return (
    <Box flexDirection="column" width={width}>
      {attachments.length > 0 && (
        <Box flexDirection="column" paddingX={1}>
          {attachments.map((att, i) => {
            const selected = !isInsert && i === vim.normalCursor;
            return (
              <Text key={att}>
                {selected ? (
                  <Text color="cyan" bold>
                    {'> '}
                  </Text>
                ) : (
                  '  '
                )}
                <Text color="magenta" dimColor={!selected}>
                  {basename(att)}
                </Text>
                {selected && <Text dimColor>{' (dd/x remove)'}</Text>}
              </Text>
            );
          })}
        </Box>
      )}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        overflowY="hidden"
        height={maxHeight ? Math.min(maxHeight, wrapLineCount(value, width - 4) + 2) : undefined}
      >
        <Box flexGrow={1}>
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCtrlV={handleCtrlV}
            onEscape={showAutocomplete ? handleAutocompleteCancel : () => vim.setMode('normal')}
            focus={inputFocused}
            showCursor={isInsert}
            placeholder="what should junior do?"
          />
        </Box>
        {!isInsert && <Text color="yellow"> NORMAL</Text>}
        {pasting && <Text dimColor> pasting...</Text>}
      </Box>
      {showAutocomplete && (
        <FileAutocomplete
          query={atQuery}
          repoPath={repoPath}
          onSelect={handleSelect}
          isActive={showAutocomplete}
          width={width}
        />
      )}
      {showCommandPicker && (
        <CommandPicker
          query={slashQuery}
          onSelect={handleCommandSelect}
          onCancel={handleCommandCancel}
          isActive={showCommandPicker}
          width={width}
        />
      )}
    </Box>
  );
}
