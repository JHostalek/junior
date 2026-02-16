export {};
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'tui') {
  const { renderTui } = await import('@/tui/App.js');
  await renderTui();
} else {
  const fs = await import('node:fs');
  const { Command } = await import('commander');
  const { getConfigPath } = await import('@/core/paths.js');
  const { saveConfig, DEFAULT_CONFIG } = await import('@/core/config.js');
  const { cliAction } = await import('@/cli/helpers.js');
  const { ensureInit } = await import('@/db/index.js');
  const { taskCommand, listAction } = await import('@/cli/task.js');
  const { scheduleCommand } = await import('@/cli/schedule.js');
  const { daemonCommand } = await import('@/cli/daemon.js');
  const { configCommand } = await import('@/cli/config.js');

  const program = new Command();

  program.name('junior').version('0.1.0').description('Autonomous software development automation CLI');

  program
    .command('init')
    .description('Initialize junior in the current repository')
    .action(
      cliAction(() => {
        ensureInit();

        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
          saveConfig(DEFAULT_CONFIG);
          console.log(`Created config at ${configPath}`);
        }

        console.log('junior initialized.');
      }),
    );

  program
    .command('ls')
    .description('List tasks (shortcut for task list)')
    .option('-s, --status <status>', 'Filter by status')
    .option('--json', 'Output as JSON')
    .action(cliAction((opts: { status?: string; json?: boolean }) => listAction(opts)));

  program.addCommand(taskCommand);
  program.addCommand(scheduleCommand);
  program.addCommand(daemonCommand);
  program.addCommand(configCommand);

  program.parse();
}
