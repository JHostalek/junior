import { errorMessage } from '@/core/errors.js';
import { warn } from '@/core/logger.js';

function getClipboardCommand(): [string, string[]] | null {
  switch (process.platform) {
    case 'darwin':
      return ['pbcopy', []];
    case 'linux':
      return ['xclip', ['-selection', 'clipboard']];
    case 'win32':
      return ['clip', []];
    default:
      return null;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  const cmd = getClipboardCommand();
  if (!cmd) return false;
  try {
    const proc = Bun.spawn([cmd[0], ...cmd[1]], { stdin: new TextEncoder().encode(text) });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (err) {
    warn('Clipboard copy failed', { error: errorMessage(err) });
    return false;
  }
}
