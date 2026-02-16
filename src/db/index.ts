import { Database } from 'bun:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { errorMessage, JuniorError } from '@/core/errors.js';
import { info } from '@/core/logger.js';
import { ensureDirectories, getDbPath } from '@/core/paths.js';
import migrations from './migrations.js';
import * as schema from './schema.js';

export { schema };

let db: ReturnType<typeof drizzle> | null = null;
let sqliteDb: Database | null = null;

export function getDb() {
  if (!db) {
    const dbPath = getDbPath();
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    } catch (err) {
      throw new JuniorError(`Failed to create database directory: ${errorMessage(err)}`);
    }
    sqliteDb = new Database(dbPath);
    sqliteDb.run('PRAGMA journal_mode = WAL');
    sqliteDb.run('PRAGMA foreign_keys = ON');
    db = drizzle(sqliteDb, { schema });
  }
  return db;
}

export function getSqlite(): Database {
  if (!sqliteDb) {
    getDb();
  }
  return sqliteDb!;
}

export function ensureInit(): void {
  ensureDirectories();
  runMigrations();
}

function runMigrations(): void {
  const sqlite = getSqlite();
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`);

  const applied = new Set(
    sqlite
      .prepare('SELECT tag FROM __drizzle_migrations')
      .all()
      .map((r) => (r as Record<string, unknown>).tag as string),
  );

  for (const m of migrations) {
    if (applied.has(m.tag)) continue;
    info('Applying migration', { tag: m.tag });
    const statements = m.sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
    sqlite.prepare('INSERT INTO __drizzle_migrations (tag, created_at) VALUES (?, ?)').run(m.tag, Date.now());
  }
}
