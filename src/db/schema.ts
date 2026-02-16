import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
};

export const jobs = sqliteTable('jobs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  status: text('status').notNull().default('queued'),
  prompt: text('prompt').notNull(),
  repoPath: text('repo_path').notNull(),
  baseBranch: text('base_branch').notNull(),
  branch: text('branch'),
  scheduleId: integer('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
  hookId: integer('hook_id').references(() => hooks.id, { onDelete: 'set null' }),
  runAt: integer('run_at'),
  sessionId: text('session_id'),
  cancelRequestedAt: integer('cancel_requested_at'),
  ...timestamps,
});

export const runs = sqliteTable('runs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  attempt: integer('attempt').notNull().default(1),
  status: text('status').notNull().default('running'),
  sessionId: text('session_id'),
  result: text('result'),
  pid: integer('pid'),
  logFile: text('log_file'),
  exitCode: integer('exit_code'),
  errorMessage: text('error_message'),
  costUsd: real('cost_usd'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  startedAt: integer('started_at').notNull().default(sql`(unixepoch())`),
  finishedAt: integer('finished_at'),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const schedules = sqliteTable('schedules', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  cron: text('cron').notNull(),
  paused: integer('paused').notNull().default(0),
  prompt: text('prompt').notNull().default(''),
  lastRunAt: integer('last_run_at'),
  nextRunAt: integer('next_run_at'),
  createdAt: timestamps.createdAt,
});

export const hooks = sqliteTable('hooks', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  checkFn: text('check_fn').notNull(),
  prompt: text('prompt').notNull(),
  stateJson: text('state_json').notNull().default('{}'),
  paused: integer('paused').notNull().default(0),
  lastCheckedAt: integer('last_checked_at'),
  lastTriggeredAt: integer('last_triggered_at'),
  createdAt: timestamps.createdAt,
});

export const daemonState = sqliteTable('daemon_state', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }).default(1),
  pid: integer('pid'),
  startedAt: integer('started_at'),
  lastHeartbeat: integer('last_heartbeat'),
});
