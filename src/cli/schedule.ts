import { Command } from 'commander';
import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { extractSchedule } from '@/core/claude.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import { cliAction, getScheduleOrExit, printTable } from './helpers.js';

export const scheduleCommand = new Command('schedule').description('Manage scheduled tasks');

scheduleCommand
  .command('add')
  .description('Add a new recurring schedule from a natural-language description')
  .argument('<description>', 'Natural-language schedule description (e.g. "run lint checks every weekday at 9am")')
  .option('--paused', 'Create in paused state')
  .action(
    cliAction(async (description: string, opts: { paused?: boolean }) => {
      console.log('Extracting schedule...');
      const extracted = await extractSchedule(description);

      const nextRun = new Cron(extracted.cron).nextRun();
      console.log();
      console.log(`  Name:   ${extracted.name}`);
      console.log(`  Cron:   ${extracted.cron}`);
      if (nextRun) {
        console.log(`  Next:   ${nextRun.toISOString()}`);
      }
      console.log(`  Prompt: ${extracted.prompt}`);
      console.log();

      ensureInit();
      const db = getDb();

      const result = db
        .insert(schema.schedules)
        .values({
          name: extracted.name,
          prompt: extracted.prompt,
          cron: extracted.cron,
          paused: opts.paused ? 1 : 0,
        })
        .returning()
        .get();

      console.log(`Schedule added with ID: ${result.id}`);
    }),
  );

scheduleCommand
  .command('list')
  .description('List all schedules')
  .action(
    cliAction(() => {
      ensureInit();
      const db = getDb();

      const rows = db.select().from(schema.schedules).all();

      if (rows.length === 0) {
        console.log('No schedules found.');
        return;
      }

      const rowData = rows.map((row) => {
        const status = row.paused ? 'paused' : 'active';
        let nextRun = 'N/A';
        if (!row.paused) {
          try {
            const next = new Cron(row.cron).nextRun();
            if (next) nextRun = next.toISOString();
          } catch {
            nextRun = 'invalid cron';
          }
        }
        return { ...row, status, nextRun };
      });

      printTable(
        [
          { header: 'ID', width: 5, value: (row) => String(row.id) },
          { header: 'NAME', width: 25, value: (row) => String(row.name) },
          { header: 'CRON', width: 20, value: (row) => String(row.cron) },
          { header: 'STATUS', width: 8, value: (row) => String(row.status) },
          { header: 'NEXT RUN', width: 30, value: (row) => String(row.nextRun) },
        ],
        rowData as unknown as Record<string, unknown>[],
      );
    }),
  );

scheduleCommand
  .command('pause')
  .description('Pause a schedule')
  .argument('<id>', 'Schedule ID')
  .action(
    cliAction((id: string) => {
      const schedule = getScheduleOrExit(id);
      const db = getDb();

      db.update(schema.schedules).set({ paused: 1 }).where(eq(schema.schedules.id, schedule.id)).run();

      console.log(`Schedule #${id} paused.`);
    }),
  );

scheduleCommand
  .command('resume')
  .description('Resume a paused schedule')
  .argument('<id>', 'Schedule ID')
  .action(
    cliAction((id: string) => {
      const schedule = getScheduleOrExit(id);
      const db = getDb();

      db.update(schema.schedules).set({ paused: 0 }).where(eq(schema.schedules.id, schedule.id)).run();

      const nextRun = new Cron(schedule.cron).nextRun();
      console.log(`Schedule #${id} resumed.`);
      if (nextRun) {
        console.log(`  Next run: ${nextRun.toISOString()}`);
      }
    }),
  );

scheduleCommand
  .command('remove')
  .description('Remove a schedule')
  .argument('<id>', 'Schedule ID')
  .action(
    cliAction((id: string) => {
      const schedule = getScheduleOrExit(id);
      const db = getDb();

      db.delete(schema.schedules).where(eq(schema.schedules.id, schedule.id)).run();

      console.log(`Schedule #${id} removed.`);
    }),
  );
