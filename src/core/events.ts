import fs from 'node:fs';
import path from 'node:path';
import { warn } from './logger.js';
import { getJuniorHome } from './paths.js';

function getEventsFile(): string {
  return path.join(getJuniorHome(), 'events');
}

export function notifyChange(): void {
  try {
    const eventsFile = getEventsFile();
    let counter = 0;
    try {
      counter = parseInt(fs.readFileSync(eventsFile, 'utf-8'), 10) || 0;
    } catch {}
    fs.writeFileSync(eventsFile, String(counter + 1), 'utf-8');
  } catch (err) {
    warn('Failed to write events file', { error: String(err) });
  }
}

export function watchChanges(callback: () => void): () => void {
  const eventsFile = getEventsFile();
  try {
    fs.writeFileSync(eventsFile, '0', { flag: 'wx' });
  } catch {}

  const watcher = fs.watch(eventsFile, () => callback());
  return () => watcher.close();
}
