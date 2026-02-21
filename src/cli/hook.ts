import { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { extractHook } from '@/core/claude.js';
import { detectMcp } from '@/core/mcp.js';
import { getRepoPath } from '@/core/paths.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import { cliAction, getHookOrExit, printTable } from './helpers.js';

export const hookCommand = new Command('hook').description('Manage reactive hooks');

hookCommand
  .command('add')
  .description('Add a new hook from a natural-language description')
  .argument('<description>', 'Natural-language hook description (e.g. "whenever main changes, review the diff")')
  .option('--paused', 'Create in paused state')
  .action(
    cliAction(async (description: string, opts: { paused?: boolean }) => {
      const mcp = detectMcp(getRepoPath());
      if (!mcp.available) {
        console.warn("Warning: Junior MCP not configured. Worker agents won't have MCP tools.");
        console.warn('See README for setup instructions.\n');
      }
      console.log('Extracting hook...');
      const extracted = await extractHook(description);

      console.log();
      console.log(`  Name:     ${extracted.name}`);
      console.log(`  Check fn: ${extracted.checkFn.slice(0, 120)}${extracted.checkFn.length > 120 ? '...' : ''}`);
      console.log(`  Prompt:   ${extracted.prompt}`);
      console.log();

      ensureInit();
      const db = getDb();

      const result = db
        .insert(schema.hooks)
        .values({
          name: extracted.name,
          checkFn: extracted.checkFn,
          prompt: extracted.prompt,
          paused: opts.paused ? 1 : 0,
        })
        .returning()
        .get();

      console.log(`Hook added with ID: ${result.id}`);
    }),
  );

hookCommand
  .command('list')
  .description('List all hooks')
  .action(
    cliAction(() => {
      ensureInit();
      const db = getDb();

      const rows = db.select().from(schema.hooks).all();

      if (rows.length === 0) {
        console.log('No hooks found.');
        return;
      }

      const rowData = rows.map((row) => {
        const status = row.paused ? 'paused' : 'active';
        const lastChecked = row.lastCheckedAt ? new Date(row.lastCheckedAt * 1000).toLocaleString() : 'never';
        const lastTriggered = row.lastTriggeredAt ? new Date(row.lastTriggeredAt * 1000).toLocaleString() : 'never';
        return { ...row, status, lastChecked, lastTriggered };
      });

      printTable(
        [
          { header: 'ID', width: 5, value: (row) => String(row.id) },
          { header: 'NAME', width: 25, value: (row) => String(row.name) },
          { header: 'STATUS', width: 8, value: (row) => String(row.status) },
          { header: 'LAST CHECKED', width: 22, value: (row) => String(row.lastChecked) },
          { header: 'LAST TRIGGERED', width: 22, value: (row) => String(row.lastTriggered) },
        ],
        rowData as unknown as Record<string, unknown>[],
      );
    }),
  );

hookCommand
  .command('show')
  .description('Show hook details')
  .argument('<id>', 'Hook ID')
  .action(
    cliAction((id: string) => {
      const hook = getHookOrExit(id);
      const status = hook.paused ? 'paused' : 'active';
      console.log(`Hook #${hook.id}`);
      console.log(`  Name:           ${hook.name}`);
      console.log(`  Status:         ${status}`);
      console.log(`  Prompt:         ${hook.prompt}`);
      console.log(`  Check fn:       ${hook.checkFn}`);
      console.log(`  State:          ${hook.stateJson}`);
      console.log(
        `  Last checked:   ${hook.lastCheckedAt ? new Date(hook.lastCheckedAt * 1000).toLocaleString() : 'never'}`,
      );
      console.log(
        `  Last triggered: ${hook.lastTriggeredAt ? new Date(hook.lastTriggeredAt * 1000).toLocaleString() : 'never'}`,
      );
      console.log(`  Created:        ${new Date(hook.createdAt * 1000).toLocaleString()}`);
    }),
  );

hookCommand
  .command('pause')
  .description('Pause a hook')
  .argument('<id>', 'Hook ID')
  .action(
    cliAction((id: string) => {
      const hook = getHookOrExit(id);
      const db = getDb();
      db.update(schema.hooks).set({ paused: 1 }).where(eq(schema.hooks.id, hook.id)).run();
      console.log(`Hook #${id} paused.`);
    }),
  );

hookCommand
  .command('resume')
  .description('Resume a paused hook')
  .argument('<id>', 'Hook ID')
  .action(
    cliAction((id: string) => {
      getHookOrExit(id);
      const db = getDb();
      db.update(schema.hooks)
        .set({ paused: 0 })
        .where(eq(schema.hooks.id, Number(id)))
        .run();
      console.log(`Hook #${id} resumed.`);
    }),
  );

hookCommand
  .command('remove')
  .description('Remove a hook')
  .argument('<id>', 'Hook ID')
  .action(
    cliAction((id: string) => {
      const hook = getHookOrExit(id);
      const db = getDb();
      db.delete(schema.hooks).where(eq(schema.hooks.id, hook.id)).run();
      console.log(`Hook #${id} removed.`);
    }),
  );
