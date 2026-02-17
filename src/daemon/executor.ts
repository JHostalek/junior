import fs from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import {
  buildClaudeArgs,
  buildFinalizeArgs,
  buildFinalizePrompt,
  CLAUDE_COMMAND,
  parseClaudeOutput,
} from '@/core/claude.js';
import {
  ACTIVITY_TIMEOUT_MS,
  CANCEL_CHECK_INTERVAL_MS,
  KILL_ESCALATION_MS,
  USAGE_THROTTLE_MS,
  WATCHDOG_INTERVAL_MS,
} from '@/core/constants.js';
import { CancelledError, ClaudeError, errorMessage } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import {
  abortMerge,
  checkout,
  createWorktree,
  forceDeleteBranch,
  generateBranchName,
  generateScheduledBranchName,
  getCurrentBranch,
  hasCommitsAhead,
  isBranchMerged,
  isMergeInProgress,
  removeSymlinks,
  removeWorktree,
  symlinkIgnored,
  tryPopJuniorStash,
} from '@/core/git.js';
import { info, error as logError, warn } from '@/core/logger.js';
import { getLogsDir, getWorktreesDir } from '@/core/paths.js';
import { getDb, getSqlite, schema } from '@/db/index.js';

function getLogFilePath(jobId: number, runId: number): string {
  return path.join(getLogsDir(), `job-${jobId}-run-${runId}.log`);
}

export interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  seenMessageIds: Set<string>;
}

export function processStreamLine(line: string, acc: UsageAccumulator): void {
  if (!line) return;
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    if (obj.type === 'assistant') {
      const message = (obj.message || {}) as Record<string, unknown>;
      const messageId = String(message.id || '');
      if (!messageId || acc.seenMessageIds.has(messageId)) return;
      acc.seenMessageIds.add(messageId);
      const usage = (message.usage || {}) as Record<string, unknown>;
      acc.inputTokens +=
        (Number(usage.input_tokens) || 0) +
        (Number(usage.cache_creation_input_tokens) || 0) +
        (Number(usage.cache_read_input_tokens) || 0);
      acc.outputTokens += Number(usage.output_tokens) || 0;
    }
  } catch {
    return;
  }
}

async function waitForClaude(
  proc: ReturnType<typeof Bun.spawn>,
  logFile: string,
  jobId: number,
  runId?: number,
): Promise<{ exitCode: number; stdout: string; usage: UsageAccumulator }> {
  let stdout = '';
  let lastActivityTime = Date.now();
  let logHandle: {
    write(chunk: Uint8Array): void;
    end(): void;
  };
  try {
    logHandle = Bun.file(logFile).writer();
  } catch (err) {
    warn('Failed to open log file for writing', { jobId, logFile, error: errorMessage(err) });
    throw new ClaudeError(`Cannot write to log file: ${logFile}`);
  }
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const acc: UsageAccumulator = { inputTokens: 0, outputTokens: 0, seenMessageIds: new Set() };
  let lastFlushTime = 0;
  let lineBuffer = '';

  function flushUsage() {
    if (!runId) return;
    const now = Date.now();
    if (now - lastFlushTime < USAGE_THROTTLE_MS) return;
    lastFlushTime = now;
    try {
      const db = getDb();
      db.update(schema.runs)
        .set({
          inputTokens: acc.inputTokens,
          outputTokens: acc.outputTokens,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(schema.runs.id, runId))
        .run();
      notifyChange();
    } catch {}
  }

  async function drainStdout(stream: ReadableStream<Uint8Array> | null) {
    if (!stream) return;
    try {
      for await (const chunk of stream) {
        const text = decoder.decode(chunk, { stream: true });
        stdout += text;
        try {
          logHandle.write(chunk);
        } catch (err) {
          warn('Failed to write to log file', { jobId, error: errorMessage(err) });
        }
        lastActivityTime = Date.now();

        lineBuffer += text;
        const parts = lineBuffer.split('\n');
        lineBuffer = parts.pop()!;
        for (const part of parts) {
          processStreamLine(part.trim(), acc);
        }
        flushUsage();
      }
      stdout += decoder.decode();
      if (lineBuffer) {
        processStreamLine(lineBuffer.trim(), acc);
        lineBuffer = '';
      }
    } catch (err) {
      warn('Error draining stdout', { jobId, error: errorMessage(err) });
    }
  }

  async function drainStderr(stream: ReadableStream<Uint8Array> | null) {
    if (!stream) return;
    try {
      for await (const chunk of stream) {
        try {
          logHandle.write(chunk);
        } catch (err) {
          warn('Failed to write stderr to log file', { jobId, error: errorMessage(err) });
        }
        lastActivityTime = Date.now();
      }
    } catch (err) {
      warn('Error draining stderr', { jobId, error: errorMessage(err) });
    }
  }

  let cancelledByUser = false;
  let killEscalationTimer: ReturnType<typeof setTimeout> | undefined;

  const watchdog = setInterval(() => {
    if (Date.now() - lastActivityTime > ACTIVITY_TIMEOUT_MS) {
      warn('Claude process timed out (no activity)', { jobId });
      proc.kill();
      clearInterval(watchdog);
    }
  }, WATCHDOG_INTERVAL_MS);

  const cancelCheck = setInterval(() => {
    try {
      const db = getDb();
      const row = db
        .select({ cancelRequestedAt: schema.jobs.cancelRequestedAt })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId))
        .get();
      if (row?.cancelRequestedAt) {
        cancelledByUser = true;
        info('Cancel requested, sending SIGTERM', { jobId });
        proc.kill('SIGTERM');
        killEscalationTimer = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {}
        }, KILL_ESCALATION_MS);
        clearInterval(cancelCheck);
      }
    } catch (err) {
      warn('Cancel check failed', { jobId, error: errorMessage(err) });
    }
  }, CANCEL_CHECK_INTERVAL_MS);

  const [exitCode] = await Promise.all([
    proc.exited,
    drainStdout(proc.stdout as ReadableStream<Uint8Array> | null),
    drainStderr(proc.stderr as ReadableStream<Uint8Array> | null),
  ]);

  clearInterval(watchdog);
  clearInterval(cancelCheck);
  if (killEscalationTimer) clearTimeout(killEscalationTimer);
  try {
    logHandle.end();
  } catch (err) {
    warn('Failed to close log file', { jobId, error: errorMessage(err) });
  }

  if (runId) {
    try {
      const db = getDb();
      db.update(schema.runs)
        .set({
          inputTokens: acc.inputTokens,
          outputTokens: acc.outputTokens,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(schema.runs.id, runId))
        .run();
      notifyChange();
    } catch (err) {
      warn('Failed to flush final usage to DB', { jobId, runId, error: errorMessage(err) });
    }
  }

  if (cancelledByUser) {
    throw new CancelledError('Cancelled by user');
  }

  return { exitCode, stdout, usage: acc };
}

export async function executeJob(job: typeof schema.jobs.$inferSelect): Promise<void> {
  const db = getDb();
  const branchName = job.scheduleId ? generateScheduledBranchName(job.title) : generateBranchName(job.title, job.id);
  const worktreePath = path.join(getWorktreesDir(), `job-${job.id}`);

  const run = getSqlite().transaction(() => {
    db.update(schema.jobs)
      .set({ status: 'running', branch: branchName, updatedAt: sql`(unixepoch())` })
      .where(eq(schema.jobs.id, job.id))
      .run();

    const r = db.insert(schema.runs).values({ jobId: job.id, attempt: 1, status: 'running' }).returning().get();

    const logFile = getLogFilePath(job.id, r.id);
    db.update(schema.runs).set({ logFile, updatedAt: sql`(unixepoch())` }).where(eq(schema.runs.id, r.id)).run();

    return { ...r, logFile };
  })();
  notifyChange();

  const logFile = run.logFile!;

  try {
    info('Creating worktree', { jobId: job.id, branch: branchName });
    await createWorktree(job.repoPath, worktreePath, branchName, job.baseBranch);
    await symlinkIgnored(job.repoPath, worktreePath);

    const childEnv = { ...process.env };
    delete childEnv.CLAUDECODE;
    childEnv.JUNIOR_HOME = job.repoPath;

    info('Spawning Worker Claude', { jobId: job.id });
    const workerProcess = Bun.spawn([CLAUDE_COMMAND, ...buildClaudeArgs(job.prompt)], {
      cwd: worktreePath,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: childEnv,
    });

    db.update(schema.runs)
      .set({ pid: workerProcess.pid, updatedAt: sql`(unixepoch())` })
      .where(eq(schema.runs.id, run.id))
      .run();

    const workerResult = await waitForClaude(workerProcess, logFile, job.id, run.id);

    db.update(schema.runs)
      .set({ exitCode: workerResult.exitCode, updatedAt: sql`(unixepoch())` })
      .where(eq(schema.runs.id, run.id))
      .run();

    if (workerResult.exitCode !== 0) {
      logError('Worker Claude exited with non-zero code', { jobId: job.id, exitCode: workerResult.exitCode });
      throw new ClaudeError(`Worker Claude exited with code ${workerResult.exitCode}`);
    }

    const claudeResult = parseClaudeOutput(workerResult.stdout);

    db.update(schema.runs)
      .set({
        status: 'succeeded',
        sessionId: claudeResult.session_id,
        result: claudeResult.result,
        costUsd: claudeResult.usage.costUsd,
        inputTokens: claudeResult.usage.inputTokens,
        outputTokens: claudeResult.usage.outputTokens,
        finishedAt: sql`(unixepoch())`,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(schema.runs.id, run.id))
      .run();
    notifyChange();

    await removeSymlinks(worktreePath);

    info('Spawning finalize agent', { jobId: job.id });
    const finalizePrompt = buildFinalizePrompt({
      repoPath: job.repoPath,
      worktreePath,
      branchName,
      baseBranch: job.baseBranch,
      jobTitle: job.title,
    });
    const originalBranch = await getCurrentBranch(job.repoPath);
    const finalizeProcess = Bun.spawn([CLAUDE_COMMAND, ...buildFinalizeArgs(finalizePrompt)], {
      cwd: job.repoPath,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: childEnv,
    });
    try {
      const finalizeResult = await waitForClaude(finalizeProcess, logFile, job.id, run.id);
      if (finalizeResult.exitCode !== 0) {
        logError('Finalize agent exited with non-zero code', {
          jobId: job.id,
          exitCode: finalizeResult.exitCode,
        });
        throw new ClaudeError(`Finalize agent exited with code ${finalizeResult.exitCode}`);
      }

      const hadChanges = await hasCommitsAhead(worktreePath, job.baseBranch);
      if (hadChanges) {
        const merged = await isBranchMerged(job.repoPath, branchName, job.baseBranch);
        if (!merged) {
          throw new ClaudeError('Finalize agent completed but merge was not performed');
        }
      } else {
        info('No changes to merge, marking job as done', { jobId: job.id });
      }
    } catch (finalizeErr) {
      warn('Finalize failed, restoring repo state', { jobId: job.id, error: errorMessage(finalizeErr) });
      try {
        if (await isMergeInProgress(job.repoPath)) {
          await abortMerge(job.repoPath);
        }
      } catch (abortErr) {
        warn('Failed to abort merge during recovery', { jobId: job.id, error: errorMessage(abortErr) });
      }
      try {
        const current = await getCurrentBranch(job.repoPath);
        if (current !== originalBranch) {
          await checkout(job.repoPath, originalBranch);
        }
      } catch (checkoutErr) {
        warn('Failed to restore original branch during recovery', { jobId: job.id, error: errorMessage(checkoutErr) });
      }
      try {
        await tryPopJuniorStash(job.repoPath);
      } catch (stashErr) {
        warn('Failed to pop stash during recovery', { jobId: job.id, error: errorMessage(stashErr) });
      }
      throw finalizeErr;
    }

    await removeWorktree(job.repoPath, worktreePath);
    await forceDeleteBranch(job.repoPath, branchName);

    db.update(schema.jobs)
      .set({
        status: 'done',
        sessionId: claudeResult.session_id,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(schema.jobs.id, job.id))
      .run();
    notifyChange();
  } catch (err) {
    if (err instanceof CancelledError) {
      info('Job cancelled by user', { jobId: job.id });
      getSqlite().transaction(() => {
        db.update(schema.runs)
          .set({
            status: 'cancelled',
            errorMessage: 'Cancelled by user',
            finishedAt: sql`(unixepoch())`,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(schema.runs.id, run.id))
          .run();

        db.update(schema.jobs)
          .set({ status: 'cancelled', cancelRequestedAt: null, updatedAt: sql`(unixepoch())` })
          .where(eq(schema.jobs.id, job.id))
          .run();
      })();
      notifyChange();
    } else {
      const errMsg = errorMessage(err);
      logError('Job execution failed', { jobId: job.id, error: errMsg });

      getSqlite().transaction(() => {
        db.update(schema.runs)
          .set({
            status: 'failed',
            errorMessage: errMsg,
            finishedAt: sql`(unixepoch())`,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(schema.runs.id, run.id))
          .run();

        db.update(schema.jobs)
          .set({ status: 'failed', updatedAt: sql`(unixepoch())` })
          .where(eq(schema.jobs.id, job.id))
          .run();
      })();
      notifyChange();
    }
  } finally {
    try {
      if (fs.existsSync(worktreePath)) {
        await removeWorktree(job.repoPath, worktreePath);
      }
    } catch (err) {
      warn('Failed to remove worktree', {
        jobId: job.id,
        error: errorMessage(err),
      });
    }
    try {
      await forceDeleteBranch(job.repoPath, branchName);
    } catch (err) {
      warn('Failed to delete branch during cleanup', {
        jobId: job.id,
        branch: branchName,
        error: errorMessage(err),
      });
    }
  }
}
