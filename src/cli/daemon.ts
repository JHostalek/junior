import { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { DAEMON_STOP_POLL_MS, DAEMON_STOP_TIMEOUT_MS } from '@/core/constants.js';
import { daemonMain } from '@/daemon/index.js';
import { isDaemonRunning, isProcessRunning, removePidFile } from '@/daemon/pid.js';
import { ensureInit, getDb, schema } from '@/db/index.js';

export const daemonCommand = new Command('daemon').description('Manage the background daemon');

daemonCommand
  .command('start')
  .description('Start the background daemon')
  .option('-f, --foreground', 'Run in the foreground')
  .action(async (opts: { foreground?: boolean }) => {
    const { running, pid } = isDaemonRunning();
    if (running) {
      console.log(`Daemon is already running (PID: ${pid}).`);
      process.exit(0);
    }

    if (opts.foreground) {
      console.log('Starting daemon in foreground...');
      await daemonMain();
      return;
    }

    ensureInit();

    const entrypoint = process.argv[1];
    const child = Bun.spawn([process.execPath, entrypoint, 'daemon', '__run'], {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    child.unref();

    console.log(`Daemon started (PID: ${child.pid}).`);
  });

daemonCommand
  .command('stop')
  .description('Stop the daemon')
  .action(async () => {
    const { running, pid } = isDaemonRunning();
    if (!running || !pid) {
      console.log('Daemon is not running.');
      return;
    }

    console.log(`Sending SIGTERM to daemon (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');

    const deadline = Date.now() + DAEMON_STOP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, DAEMON_STOP_POLL_MS));
      if (!isProcessRunning(pid)) {
        console.log('Daemon stopped.');
        removePidFile();
        return;
      }
    }

    console.log('Daemon did not stop gracefully, sending SIGKILL...');
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
    removePidFile();
    console.log('Daemon killed.');
  });

daemonCommand
  .command('status')
  .description('Show daemon status')
  .action(() => {
    const { running, pid } = isDaemonRunning();

    if (!running) {
      console.log('Daemon is not running.');
      return;
    }

    console.log(`Daemon is running (PID: ${pid}).`);

    try {
      ensureInit();
      const db = getDb();
      const state = db.select().from(schema.daemonState).where(eq(schema.daemonState.id, 1)).get();

      if (state) {
        if (state.startedAt) {
          const uptime = Math.floor(Date.now() / 1000) - state.startedAt;
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = uptime % 60;
          console.log(`  Uptime:         ${hours}h ${minutes}m ${seconds}s`);
        }
        if (state.lastHeartbeat) {
          const ago = Math.floor(Date.now() / 1000) - state.lastHeartbeat;
          console.log(`  Last heartbeat: ${ago}s ago`);
        }
      }

      const runningJobs = db.select().from(schema.jobs).where(eq(schema.jobs.status, 'running')).all();
      console.log(`  Active jobs:    ${runningJobs.length}`);

      const queuedJobs = db.select().from(schema.jobs).where(eq(schema.jobs.status, 'queued')).all();
      console.log(`  Queued jobs:    ${queuedJobs.length}`);
    } catch {}
  });

daemonCommand.command('__run', { hidden: true }).action(async () => {
  await daemonMain();
});
