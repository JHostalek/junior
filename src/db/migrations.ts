interface Migration {
  tag: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    tag: '0000_initial',
    sql: `
      CREATE TABLE IF NOT EXISTS daemon_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT DEFAULT 1 NOT NULL,
        pid INTEGER,
        started_at INTEGER,
        last_heartbeat INTEGER
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'queued' NOT NULL,
        prompt TEXT NOT NULL,
        repo_path TEXT NOT NULL,
        base_branch TEXT DEFAULT 'main' NOT NULL,
        branch TEXT,
        schedule_id INTEGER,
        run_at INTEGER,
        session_id TEXT,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        job_id INTEGER NOT NULL,
        attempt INTEGER DEFAULT 1 NOT NULL,
        status TEXT DEFAULT 'running' NOT NULL,
        session_id TEXT,
        result TEXT,
        pid INTEGER,
        log_file TEXT,
        exit_code INTEGER,
        error_message TEXT,
        started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        finished_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        paused INTEGER DEFAULT 0 NOT NULL,
        task_file_path TEXT NOT NULL,
        last_run_at INTEGER,
        next_run_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `,
  },
  {
    tag: '0001_runs_updated_at',
    sql: `
      ALTER TABLE runs ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
      UPDATE runs SET updated_at = started_at WHERE updated_at = 0;
    `,
  },
  {
    tag: '0002_runs_usage',
    sql: `
      ALTER TABLE runs ADD COLUMN cost_usd REAL;
      ALTER TABLE runs ADD COLUMN input_tokens INTEGER;
      ALTER TABLE runs ADD COLUMN output_tokens INTEGER;
    `,
  },
  {
    tag: '0003_cancel_requested_at',
    sql: `ALTER TABLE jobs ADD COLUMN cancel_requested_at INTEGER;`,
  },
  {
    tag: '0004_schedule_inline_prompt',
    sql: `
      ALTER TABLE schedules ADD COLUMN prompt TEXT NOT NULL DEFAULT '';
      DELETE FROM schedules;
    `,
  },
  {
    tag: '0005_drop_task_file_path',
    sql: `
      CREATE TABLE schedules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        paused INTEGER DEFAULT 0 NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        last_run_at INTEGER,
        next_run_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
      INSERT INTO schedules_new (id, name, cron, paused, prompt, last_run_at, next_run_at, created_at)
        SELECT id, name, cron, paused, prompt, last_run_at, next_run_at, created_at FROM schedules;
      DROP TABLE schedules;
      ALTER TABLE schedules_new RENAME TO schedules;
    `,
  },
  {
    tag: '0006_hooks',
    sql: `
      CREATE TABLE hooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        check_fn TEXT NOT NULL,
        prompt TEXT NOT NULL,
        state_json TEXT NOT NULL DEFAULT '{}',
        paused INTEGER DEFAULT 0 NOT NULL,
        last_checked_at INTEGER,
        last_triggered_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
      ALTER TABLE jobs ADD COLUMN hook_id INTEGER REFERENCES hooks(id) ON DELETE SET NULL;
    `,
  },
];

export default migrations;
