import fs from 'node:fs';
import { getPidFile } from '@/core/paths.js';

export function writePidFile(pid: number): void {
  fs.writeFileSync(getPidFile(), String(pid), 'utf-8');
}

export function readPidFile(): number | null {
  try {
    const content = fs.readFileSync(getPidFile(), 'utf-8').trim();
    const pid = parseInt(content, 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function removePidFile(): void {
  try {
    fs.unlinkSync(getPidFile());
  } catch {}
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonRunning(): { running: boolean; pid: number | null } {
  const pid = readPidFile();
  if (pid === null) {
    return { running: false, pid: null };
  }
  if (isProcessRunning(pid)) {
    return { running: true, pid };
  }
  removePidFile();
  return { running: false, pid: null };
}
