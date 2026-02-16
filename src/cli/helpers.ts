import { eq } from 'drizzle-orm';
import { errorMessage } from '@/core/errors.js';
import { ensureInit, getDb, schema } from '@/db/index.js';

export async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);

  if (typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const key = await new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString());
      });
    });
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write('\n');
    return key.toLowerCase() === 'y';
  }

  const line = await new Promise<string>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
  process.stdin.pause();
  return line.toLowerCase() === 'y' || line.toLowerCase() === 'yes';
}

export function cliAction<T extends unknown[]>(
  fn: (...args: T) => void | Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`Error: ${errorMessage(err)}`);
      process.exit(1);
    }
  };
}

export function getJobOrExit(id: string) {
  ensureInit();
  const db = getDb();
  const job = db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, Number(id)))
    .get();
  if (!job) {
    console.error(`Task #${id} not found.`);
    process.exit(1);
  }
  return job;
}

export function getScheduleOrExit(id: string) {
  ensureInit();
  const db = getDb();
  const schedule = db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.id, Number(id)))
    .get();
  if (!schedule) {
    console.error(`Schedule with ID ${id} not found.`);
    process.exit(1);
  }
  return schedule;
}

interface Column {
  header: string;
  width: number;
  value: (row: Record<string, unknown>) => string;
}

export function printTable(columns: Column[], rows: Record<string, unknown>[]): void {
  console.log(columns.map((c) => c.header.padEnd(c.width)).join(''));
  console.log('-'.repeat(columns.reduce((sum, c) => sum + c.width, 0)));

  for (const row of rows) {
    console.log(
      columns
        .map((c) => {
          const val = c.value(row);
          return (val.length > c.width - 2 ? `${val.substring(0, c.width - 5)}...` : val).padEnd(c.width);
        })
        .join(''),
    );
  }
}
