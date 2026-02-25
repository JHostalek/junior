import { and, eq, inArray, sql } from 'drizzle-orm';
import { HOOK_POLL_INTERVAL_MS } from '@/core/constants.js';
import { errorMessage } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import { getDefaultBranch } from '@/core/git.js';
import { evaluateHook } from '@/core/hooks.js';
import { info, error as logError, warn } from '@/core/logger.js';
import { getRepoPath } from '@/core/paths.js';
import { getDb, schema } from '@/db/index.js';

const hookTimers = new Map<number, ReturnType<typeof setInterval>>();
const activeHookChecks = new Set<number>();

async function checkHook(hookId: number): Promise<void> {
  if (activeHookChecks.has(hookId)) return;
  activeHookChecks.add(hookId);

  try {
    const db = getDb();
    const hook = db.select().from(schema.hooks).where(eq(schema.hooks.id, hookId)).get();
    if (!hook || hook.paused) return;

    const hasActiveJob = db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.hookId, hookId), inArray(schema.jobs.status, ['queued', 'running'])))
      .get();

    if (hasActiveJob) return;

    const repoPath = getRepoPath();
    const state: Record<string, unknown> = JSON.parse(hook.stateJson || '{}');
    const result = await evaluateHook(hook.checkFn, repoPath, state);

    if (result.error) {
      warn('Hook evaluation error', { hookId, name: hook.name, error: result.error });
    }

    const updates: Record<string, unknown> = {
      lastCheckedAt: sql`(unixepoch())`,
      stateJson: JSON.stringify(result.state),
      lastError: result.error ?? null,
    };

    if (result.triggered) {
      const baseBranch = await getDefaultBranch(repoPath);

      db.insert(schema.jobs)
        .values({
          title: hook.name,
          prompt: hook.prompt,
          repoPath,
          baseBranch,
          hookId: hook.id,
        })
        .run();

      updates.lastTriggeredAt = sql`(unixepoch())`;
      info('Hook triggered', { hookId, name: hook.name });
    }

    db.update(schema.hooks).set(updates).where(eq(schema.hooks.id, hookId)).run();

    if (result.triggered) {
      notifyChange();
    }
  } catch (err) {
    logError('Hook check failed', { hookId, error: errorMessage(err) });
  } finally {
    activeHookChecks.delete(hookId);
  }
}

export function loadHooks(): void {
  const db = getDb();
  const activeHooks = db.select().from(schema.hooks).where(eq(schema.hooks.paused, 0)).all();

  const activeIds = new Set(activeHooks.map((h) => h.id));

  for (const [id, timer] of hookTimers) {
    if (!activeIds.has(id)) {
      clearInterval(timer);
      hookTimers.delete(id);
    }
  }

  for (const hook of activeHooks) {
    if (hookTimers.has(hook.id)) continue;
    const timer = setInterval(() => {
      checkHook(hook.id);
    }, HOOK_POLL_INTERVAL_MS);
    hookTimers.set(hook.id, timer);
  }

  info('Hooks loaded', { count: activeHooks.length });
}

export function stopAllHooks(): void {
  for (const [id, timer] of hookTimers) {
    clearInterval(timer);
    hookTimers.delete(id);
  }
  info('All hooks stopped');
}
