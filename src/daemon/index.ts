import { eq, sql } from 'drizzle-orm';
import { loadConfig } from '@/core/config.js';
import { HEARTBEAT_INTERVAL_MS, POLL_INTERVAL_MS, SHUTDOWN_TIMEOUT_MS } from '@/core/constants.js';
import { DaemonError, errorMessage } from '@/core/errors.js';
import { watchChanges } from '@/core/events.js';
import { info, error as logError } from '@/core/logger.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import { startPollLoop, stopPollLoop } from './loop.js';
import { isDaemonRunning, removePidFile, writePidFile } from './pid.js';
import { recoverOrphanedJobs } from './recovery.js';
import { loadSchedules, stopAll as stopAllSchedules } from './scheduler.js';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let stopWatchingChanges: (() => void) | null = null;
let shuttingDown = false;

function startHeartbeat(): void {
  const db = getDb();

  const existing = db.select().from(schema.daemonState).where(eq(schema.daemonState.id, 1)).get();

  const stateValues = {
    pid: process.pid,
    startedAt: sql`(unixepoch())`,
    lastHeartbeat: sql`(unixepoch())`,
  };

  if (existing) {
    db.update(schema.daemonState).set(stateValues).where(eq(schema.daemonState.id, 1)).run();
  } else {
    db.insert(schema.daemonState)
      .values({ id: 1, ...stateValues })
      .run();
  }

  heartbeatTimer = setInterval(() => {
    try {
      db.update(schema.daemonState)
        .set({ lastHeartbeat: sql`(unixepoch())` })
        .where(eq(schema.daemonState.id, 1))
        .run();
    } catch (err) {
      logError('Heartbeat failed', {
        error: errorMessage(err),
      });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function gracefulShutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  if (stopWatchingChanges) {
    stopWatchingChanges();
    stopWatchingChanges = null;
  }
  stopAllSchedules();
  stopHeartbeat();

  await stopPollLoop(SHUTDOWN_TIMEOUT_MS);

  try {
    const db = getDb();
    db.update(schema.daemonState).set({ pid: null }).where(eq(schema.daemonState.id, 1)).run();
  } catch (err) {
    logError('Failed to clear daemon state during shutdown', { error: errorMessage(err) });
  }

  removePidFile();
  info('Daemon stopped');
  process.exit(0);
}

export async function daemonMain(): Promise<void> {
  const config = loadConfig();

  ensureInit();

  const existing = isDaemonRunning();
  if (existing.running) {
    throw new DaemonError(`Another daemon is already running (pid ${existing.pid})`);
  }

  writePidFile(process.pid);
  await recoverOrphanedJobs();
  startHeartbeat();
  loadSchedules();
  stopWatchingChanges = watchChanges(() => loadSchedules());
  startPollLoop(POLL_INTERVAL_MS);

  const onShutdown = () => {
    gracefulShutdown().catch((err) => {
      logError('Error during shutdown', {
        error: errorMessage(err),
      });
      process.exit(1);
    });
  };

  process.on('SIGTERM', onShutdown);
  process.on('SIGINT', onShutdown);

  info('Daemon running', {
    pid: process.pid,
    maxConcurrency: config.max_concurrency,
  });
}
