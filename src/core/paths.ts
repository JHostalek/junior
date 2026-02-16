import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getJuniorHome(): string {
  return path.join(process.cwd(), '.junior');
}

export function getDbPath(): string {
  return path.join(getJuniorHome(), 'junior.db');
}

export function getConfigPath(): string {
  return path.join(getJuniorHome(), 'config.yaml');
}

export function getPidFile(): string {
  return path.join(getJuniorHome(), 'daemon.pid');
}

export function getLogsDir(): string {
  return path.join(getJuniorHome(), 'logs');
}

export function getWorktreesDir(): string {
  return path.join(getJuniorHome(), 'worktrees');
}

export function getAttachmentsDir(): string {
  return path.join(getJuniorHome(), 'attachments');
}

export function getRepoPath(): string {
  return process.cwd();
}

export function ensureDirectories(): void {
  fs.mkdirSync(getJuniorHome(), { recursive: true });
  fs.mkdirSync(getLogsDir(), { recursive: true });
  fs.mkdirSync(getWorktreesDir(), { recursive: true });
  fs.mkdirSync(getAttachmentsDir(), { recursive: true });
}

export function resolvePath(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p);
}
