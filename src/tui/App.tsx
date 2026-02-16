import { eq, inArray, sql } from 'drizzle-orm';
import { Box, render, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteJob } from '@/cli/task.js';
import { extractHook, extractSchedule } from '@/core/claude.js';
import { loadConfig, setConfigValue } from '@/core/config.js';
import { DOUBLE_DELETE_TIMEOUT_MS, MESSAGE_FLASH_DURATION_MS, TITLE_MAX_LENGTH } from '@/core/constants.js';
import { errorMessage } from '@/core/errors.js';
import { notifyChange } from '@/core/events.js';
import { getCurrentBranch } from '@/core/git.js';
import { info } from '@/core/logger.js';
import { getRepoPath } from '@/core/paths.js';
import { isDaemonRunning } from '@/daemon/pid.js';
import { ensureInit, getDb, schema } from '@/db/index.js';
import { AddHook } from './AddHook.js';
import { AddSchedule } from './AddSchedule.js';
import { AddTask } from './AddTask.js';
import { copyToClipboard } from './clipboard.js';
import { startDaemon, stopDaemon } from './daemon.js';
import { EditHook } from './EditHook.js';
import { EditSchedule } from './EditSchedule.js';
import { ExitDialog } from './ExitDialog.js';
import { HookDetail, useHookJobs } from './HookDetail.js';
import { HookList } from './HookList.js';
import { buildHints } from './hints.js';
import { useJuniorData } from './hooks.js';
import { ScheduleDetail, useScheduleJobs } from './ScheduleDetail.js';
import { ScheduleList } from './ScheduleList.js';
import { StatusBar } from './StatusBar.js';
import { TaskDetail } from './TaskDetail.js';
import { TaskList } from './TaskList.js';
import { useTerminalSize } from './useTerminalSize.js';
import type { VimMode } from './useVimMode.js';

type View =
  | 'input'
  | 'list'
  | 'detail'
  | 'schedules'
  | 'scheduleDetail'
  | 'addSchedule'
  | 'editSchedule'
  | 'hooks'
  | 'hookDetail'
  | 'addHook'
  | 'editHook'
  | 'exiting';

const TOP_LEVEL_SECTIONS = ['input', 'list', 'schedules', 'hooks'] as const;
type TopLevelSection = (typeof TOP_LEVEL_SECTIONS)[number];

function isTopLevel(v: View): v is TopLevelSection {
  return (TOP_LEVEL_SECTIONS as readonly string[]).includes(v);
}

const FILTERS = [null, 'queued', 'running', 'failed', 'done'] as const;

function App() {
  const { exit } = useApp();
  const { rows, columns } = useTerminalSize();
  const [view, setView] = useState<View>('input');
  const [cursor, setCursor] = useState(0);
  const [filterIdx, setFilterIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [message, setMessage] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [exitRemember, setExitRemember] = useState(false);
  const [inputMode, setInputMode] = useState<VimMode>('insert');
  const [pendingD, setPendingD] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [visualAnchor, setVisualAnchor] = useState<number | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<number[] | null>(null);
  const [scheduleCursor, setScheduleCursor] = useState(0);
  const [schedPendingD, setSchedPendingD] = useState(false);
  const [schedDeleteConfirm, setSchedDeleteConfirm] = useState<number | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<'list' | 'scheduleDetail' | 'hookDetail'>('list');
  const [schedDetailId, setSchedDetailId] = useState<number | null>(null);
  const [schedDetailJobCursor, setSchedDetailJobCursor] = useState(0);
  const [schedDetailJobCount, setSchedDetailJobCount] = useState(0);
  const [detailJob, setDetailJob] = useState<(typeof jobs)[number] | null>(null);
  const [editScheduleId, setEditScheduleId] = useState<number | null>(null);
  const [editOrigin, setEditOrigin] = useState<'schedules' | 'scheduleDetail'>('schedules');
  const [hookCursor, setHookCursor] = useState(0);
  const [hookPendingD, setHookPendingD] = useState(false);
  const [hookDeleteConfirm, setHookDeleteConfirm] = useState<number | null>(null);
  const [hookDetailId, setHookDetailId] = useState<number | null>(null);
  const [hookDetailJobCursor, setHookDetailJobCursor] = useState(0);
  const [hookDetailJobCount, setHookDetailJobCount] = useState(0);
  const [editHookId, setEditHookId] = useState<number | null>(null);
  const [editHookOrigin, setEditHookOrigin] = useState<'hooks' | 'hookDetail'>('hooks');
  const pendingDTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedPendingDTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookPendingDTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getCurrentBranch(getRepoPath())
      .then(setBaseBranch)
      .catch((err) => {
        info("Failed to detect current branch, defaulting to 'main'", { error: errorMessage(err) });
      });
  }, []);

  useEffect(() => {
    const { running } = isDaemonRunning();
    if (!running) {
      const proc = Bun.spawn([process.execPath, 'daemon', '__run'], {
        stdin: 'ignore',
        stdout: 'ignore',
        stderr: 'ignore',
      });
      proc.unref();
    }
  }, []);

  const filter = FILTERS[filterIdx];
  const data = useJuniorData(filter);
  const { jobs } = data;

  const selectedRange: [number, number] | null =
    visualAnchor !== null ? [Math.min(visualAnchor, cursor), Math.max(visualAnchor, cursor)] : null;
  const selectedJobs = selectedRange !== null ? jobs.slice(selectedRange[0], selectedRange[1] + 1) : [];

  useEffect(() => {
    if (visualAnchor === null) return;
    if (jobs.length === 0) {
      setVisualAnchor(null);
      setBatchDeleteConfirm(null);
      return;
    }
    if (visualAnchor >= jobs.length) {
      setVisualAnchor(jobs.length - 1);
    }
  }, [jobs, visualAnchor]);

  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), MESSAGE_FLASH_DURATION_MS);
  }, []);

  const selectedJob = jobs[cursor] ?? null;
  const { schedules } = data;
  const selectedSchedule = schedules[scheduleCursor] ?? null;
  const activeDetailSchedule = schedDetailId !== null ? (schedules.find((s) => s.id === schedDetailId) ?? null) : null;
  const schedDetailJobs = useScheduleJobs(activeDetailSchedule?.id ?? null);
  const schedDetailSelectedJob = schedDetailJobs[schedDetailJobCursor] ?? null;
  const activeDetailJob = detailJob ?? selectedJob;

  const { hooks: hooksList } = data;
  const selectedHook = hooksList[hookCursor] ?? null;
  const activeDetailHook = hookDetailId !== null ? (hooksList.find((h) => h.id === hookDetailId) ?? null) : null;
  const hookDetailJobs = useHookJobs(activeDetailHook?.id ?? null);
  const hookDetailSelectedJob = hookDetailJobs[hookDetailJobCursor] ?? null;

  useEffect(() => {
    if (view === 'scheduleDetail' && activeDetailSchedule === null) {
      setView('schedules');
      setSchedDetailId(null);
    }
  }, [view, activeDetailSchedule]);

  useEffect(() => {
    if (view === 'hookDetail' && activeDetailHook === null) {
      setView('hooks');
      setHookDetailId(null);
    }
  }, [view, activeDetailHook]);

  const handleExit = useCallback(() => {
    const { running } = isDaemonRunning();
    if (!running) {
      exit();
      return;
    }
    const config = loadConfig();
    if (config.on_exit === 'stop') {
      stopDaemon(() => exit());
      return;
    }
    if (config.on_exit === 'keep') {
      exit();
      return;
    }
    setView('exiting');
  }, [exit]);

  const handleExitChoice = useCallback(
    (choice: 'stop' | 'keep', remember: boolean) => {
      if (remember) setConfigValue('on_exit', choice);
      if (choice === 'stop') {
        stopDaemon(() => exit());
        return;
      }
      exit();
    },
    [exit],
  );

  const handleExitCancel = useCallback(() => {
    setView('input');
  }, []);

  const navigateToSection = useCallback(
    (section: TopLevelSection) => {
      if (view === 'list' && visualAnchor !== null) {
        setVisualAnchor(null);
        setBatchDeleteConfirm(null);
      }
      setView(section);
    },
    [view, visualAnchor],
  );

  useInput((input, key) => {
    if (view === 'exiting') return;

    if (isTopLevel(view)) {
      if (view === 'input' && inputMode === 'insert' && inputValueRef.current.length > 0) {
        // fall through — don't intercept tab/number keys while typing
      } else {
        if (key.tab) {
          const idx = TOP_LEVEL_SECTIONS.indexOf(view);
          const next = key.shift
            ? TOP_LEVEL_SECTIONS[(idx - 1 + TOP_LEVEL_SECTIONS.length) % TOP_LEVEL_SECTIONS.length]
            : TOP_LEVEL_SECTIONS[(idx + 1) % TOP_LEVEL_SECTIONS.length];
          navigateToSection(next);
          return;
        }
        const numMap: Record<string, TopLevelSection> = { '1': 'input', '2': 'list', '3': 'schedules', '4': 'hooks' };
        const target = numMap[input];
        if (target && target !== view) {
          navigateToSection(target);
          return;
        }
        if (target && target === view) return;
      }
    }

    if (view === 'input') {
      if (key.ctrl && input === 'c') {
        if (inputValueRef.current.length === 0) {
          handleExit();
        } else {
          setInputValue('');
        }
        return;
      }
      return;
    }

    if (view === 'detail') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }
      if (key.escape || key.return) {
        if (detailOrigin === 'scheduleDetail') {
          setDetailJob(null);
          setView('scheduleDetail');
        } else if (detailOrigin === 'hookDetail') {
          setDetailJob(null);
          setView('hookDetail');
        } else {
          setView('list');
        }
        return;
      }
      return;
    }

    if (view === 'addSchedule' || view === 'editSchedule' || view === 'addHook' || view === 'editHook') return;

    if (view === 'scheduleDetail') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }
      if (key.escape) {
        setView('schedules');
        setSchedDetailId(null);
        setSchedDetailJobCursor(0);
        return;
      }
      if (key.upArrow || input === 'k') {
        setSchedDetailJobCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setSchedDetailJobCursor((c) => Math.min(schedDetailJobCount - 1, c + 1));
        return;
      }
      if (key.return) {
        if (schedDetailSelectedJob) {
          setDetailJob(schedDetailSelectedJob);
          setDetailOrigin('scheduleDetail');
          setView('detail');
        }
        return;
      }
      if (input === 'e') {
        if (activeDetailSchedule) {
          setEditScheduleId(activeDetailSchedule.id);
          setEditOrigin('scheduleDetail');
          setView('editSchedule');
        }
        return;
      }
      if (input === 'c') {
        if (!schedDetailSelectedJob) return;
        if (schedDetailSelectedJob.status === 'queued') {
          getDb()
            .update(schema.jobs)
            .set({ status: 'cancelled' })
            .where(eq(schema.jobs.id, schedDetailSelectedJob.id))
            .run();
          notifyChange();
          flash(`#${schedDetailSelectedJob.id} cancelled`);
        } else if (schedDetailSelectedJob.status === 'running') {
          getDb()
            .update(schema.jobs)
            .set({ cancelRequestedAt: sql`(unixepoch())` })
            .where(eq(schema.jobs.id, schedDetailSelectedJob.id))
            .run();
          notifyChange();
          flash(`#${schedDetailSelectedJob.id} cancelling...`);
        } else {
          flash('can only cancel queued or running tasks');
        }
        return;
      }
      if (input === 'r') {
        if (!schedDetailSelectedJob) return;
        if (schedDetailSelectedJob.status !== 'failed') {
          flash('can only retry failed tasks');
          return;
        }
        getDb()
          .update(schema.jobs)
          .set({ status: 'queued', runAt: null })
          .where(eq(schema.jobs.id, schedDetailSelectedJob.id))
          .run();
        notifyChange();
        flash(`#${schedDetailSelectedJob.id} re-queued`);
        return;
      }
      if (input === 'l') {
        if (!schedDetailSelectedJob) return;
        const text = `junior task logs ${schedDetailSelectedJob.id}`;
        copyToClipboard(text).then((ok) => {
          flash(ok ? `copied: ${text}` : 'clipboard failed');
        });
        return;
      }
      if (deleteConfirm !== null) {
        if (input === 'y') {
          const jobId = deleteConfirm;
          setDeleteConfirm(null);
          deleteJob(jobId)
            .then(() => {
              flash(`#${jobId} deleted`);
              notifyChange();
            })
            .catch((err) => {
              flash(`delete failed: ${errorMessage(err)}`);
            });
          return;
        }
        setDeleteConfirm(null);
        return;
      }
      if (input === 'd') {
        if (!schedDetailSelectedJob) return;
        if (pendingD) {
          if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
          setPendingD(false);
          if (schedDetailSelectedJob.status === 'running') {
            flash('cancel the task before deleting');
            return;
          }
          setDeleteConfirm(schedDetailSelectedJob.id);
          return;
        }
        setPendingD(true);
        pendingDTimer.current = setTimeout(() => setPendingD(false), DOUBLE_DELETE_TIMEOUT_MS);
        return;
      }
      if (pendingD) {
        setPendingD(false);
        if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
      }
      return;
    }

    if (view === 'schedules') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }
      if (key.escape) {
        setView('input');
        return;
      }
      if (key.upArrow || input === 'k') {
        setScheduleCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setScheduleCursor((c) => Math.min(schedules.length - 1, c + 1));
        return;
      }
      if (key.return) {
        if (selectedSchedule) {
          setSchedDetailId(selectedSchedule.id);
          setSchedDetailJobCursor(0);
          setSchedDetailJobCount(0);
          setView('scheduleDetail');
        }
        return;
      }
      if (input === 'e') {
        if (selectedSchedule) {
          setEditScheduleId(selectedSchedule.id);
          setEditOrigin('schedules');
          setView('editSchedule');
        }
        return;
      }
      if (input === 'p') {
        if (!selectedSchedule) return;
        const db = getDb();
        const newPaused = selectedSchedule.paused ? 0 : 1;
        db.update(schema.schedules)
          .set({ paused: newPaused })
          .where(eq(schema.schedules.id, selectedSchedule.id))
          .run();
        notifyChange();
        flash(`#${selectedSchedule.id} ${newPaused ? 'paused' : 'resumed'}`);
        return;
      }
      if (schedDeleteConfirm !== null) {
        if (input === 'y') {
          const id = schedDeleteConfirm;
          setSchedDeleteConfirm(null);
          getDb().delete(schema.schedules).where(eq(schema.schedules.id, id)).run();
          notifyChange();
          flash(`schedule #${id} removed`);
          setScheduleCursor((c) => Math.min(c, Math.max(0, schedules.length - 2)));
          return;
        }
        setSchedDeleteConfirm(null);
        return;
      }
      if (input === 'd') {
        if (!selectedSchedule) return;
        if (schedPendingD) {
          if (schedPendingDTimer.current) clearTimeout(schedPendingDTimer.current);
          setSchedPendingD(false);
          setSchedDeleteConfirm(selectedSchedule.id);
          return;
        }
        setSchedPendingD(true);
        schedPendingDTimer.current = setTimeout(() => setSchedPendingD(false), DOUBLE_DELETE_TIMEOUT_MS);
        return;
      }
      if (schedPendingD) {
        setSchedPendingD(false);
        if (schedPendingDTimer.current) clearTimeout(schedPendingDTimer.current);
      }
      return;
    }

    if (view === 'hookDetail') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }
      if (key.escape) {
        setView('hooks');
        setHookDetailId(null);
        setHookDetailJobCursor(0);
        return;
      }
      if (key.upArrow || input === 'k') {
        setHookDetailJobCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setHookDetailJobCursor((c) => Math.min(hookDetailJobCount - 1, c + 1));
        return;
      }
      if (key.return) {
        if (hookDetailSelectedJob) {
          setDetailJob(hookDetailSelectedJob);
          setDetailOrigin('hookDetail');
          setView('detail');
        }
        return;
      }
      if (input === 'e') {
        if (activeDetailHook) {
          setEditHookId(activeDetailHook.id);
          setEditHookOrigin('hookDetail');
          setView('editHook');
        }
        return;
      }
      if (input === 'c') {
        if (!hookDetailSelectedJob) return;
        if (hookDetailSelectedJob.status === 'queued') {
          getDb()
            .update(schema.jobs)
            .set({ status: 'cancelled' })
            .where(eq(schema.jobs.id, hookDetailSelectedJob.id))
            .run();
          notifyChange();
          flash(`#${hookDetailSelectedJob.id} cancelled`);
        } else if (hookDetailSelectedJob.status === 'running') {
          getDb()
            .update(schema.jobs)
            .set({ cancelRequestedAt: sql`(unixepoch())` })
            .where(eq(schema.jobs.id, hookDetailSelectedJob.id))
            .run();
          notifyChange();
          flash(`#${hookDetailSelectedJob.id} cancelling...`);
        } else {
          flash('can only cancel queued or running tasks');
        }
        return;
      }
      if (input === 'r') {
        if (!hookDetailSelectedJob) return;
        if (hookDetailSelectedJob.status !== 'failed') {
          flash('can only retry failed tasks');
          return;
        }
        getDb()
          .update(schema.jobs)
          .set({ status: 'queued', runAt: null })
          .where(eq(schema.jobs.id, hookDetailSelectedJob.id))
          .run();
        notifyChange();
        flash(`#${hookDetailSelectedJob.id} re-queued`);
        return;
      }
      if (input === 'l') {
        if (!hookDetailSelectedJob) return;
        const text = `junior task logs ${hookDetailSelectedJob.id}`;
        copyToClipboard(text).then((ok) => {
          flash(ok ? `copied: ${text}` : 'clipboard failed');
        });
        return;
      }
      if (deleteConfirm !== null) {
        if (input === 'y') {
          const jobId = deleteConfirm;
          setDeleteConfirm(null);
          deleteJob(jobId)
            .then(() => {
              flash(`#${jobId} deleted`);
              notifyChange();
            })
            .catch((err) => {
              flash(`delete failed: ${errorMessage(err)}`);
            });
          return;
        }
        setDeleteConfirm(null);
        return;
      }
      if (input === 'd') {
        if (!hookDetailSelectedJob) return;
        if (pendingD) {
          if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
          setPendingD(false);
          if (hookDetailSelectedJob.status === 'running') {
            flash('cancel the task before deleting');
            return;
          }
          setDeleteConfirm(hookDetailSelectedJob.id);
          return;
        }
        setPendingD(true);
        pendingDTimer.current = setTimeout(() => setPendingD(false), DOUBLE_DELETE_TIMEOUT_MS);
        return;
      }
      if (pendingD) {
        setPendingD(false);
        if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
      }
      return;
    }

    if (view === 'hooks') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }
      if (key.escape) {
        setView('input');
        return;
      }
      if (key.upArrow || input === 'k') {
        setHookCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setHookCursor((c) => Math.min(hooksList.length - 1, c + 1));
        return;
      }
      if (key.return) {
        if (selectedHook) {
          setHookDetailId(selectedHook.id);
          setHookDetailJobCursor(0);
          setHookDetailJobCount(0);
          setView('hookDetail');
        }
        return;
      }
      if (input === 'e') {
        if (selectedHook) {
          setEditHookId(selectedHook.id);
          setEditHookOrigin('hooks');
          setView('editHook');
        }
        return;
      }
      if (input === 'p') {
        if (!selectedHook) return;
        const db = getDb();
        const newPaused = selectedHook.paused ? 0 : 1;
        db.update(schema.hooks).set({ paused: newPaused }).where(eq(schema.hooks.id, selectedHook.id)).run();
        notifyChange();
        flash(`#${selectedHook.id} ${newPaused ? 'paused' : 'resumed'}`);
        return;
      }
      if (hookDeleteConfirm !== null) {
        if (input === 'y') {
          const id = hookDeleteConfirm;
          setHookDeleteConfirm(null);
          getDb().delete(schema.hooks).where(eq(schema.hooks.id, id)).run();
          notifyChange();
          flash(`hook #${id} removed`);
          setHookCursor((c) => Math.min(c, Math.max(0, hooksList.length - 2)));
          return;
        }
        setHookDeleteConfirm(null);
        return;
      }
      if (input === 'd') {
        if (!selectedHook) return;
        if (hookPendingD) {
          if (hookPendingDTimer.current) clearTimeout(hookPendingDTimer.current);
          setHookPendingD(false);
          setHookDeleteConfirm(selectedHook.id);
          return;
        }
        setHookPendingD(true);
        hookPendingDTimer.current = setTimeout(() => setHookPendingD(false), DOUBLE_DELETE_TIMEOUT_MS);
        return;
      }
      if (hookPendingD) {
        setHookPendingD(false);
        if (hookPendingDTimer.current) clearTimeout(hookPendingDTimer.current);
      }
      return;
    }

    if (view === 'list') {
      if (key.ctrl && input === 'c') {
        handleExit();
        return;
      }

      if (visualAnchor !== null) {
        if (key.escape) {
          setVisualAnchor(null);
          setBatchDeleteConfirm(null);
          return;
        }
        if (key.upArrow || input === 'k') {
          setCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow || input === 'j') {
          setCursor((c) => Math.min(jobs.length - 1, c + 1));
          return;
        }
        if (batchDeleteConfirm !== null) {
          if (input === 'y') {
            const ids = batchDeleteConfirm;
            setBatchDeleteConfirm(null);
            setVisualAnchor(null);
            Promise.all(ids.map((id) => deleteJob(id)))
              .then(() => {
                flash(`${ids.length} deleted`);
                notifyChange();
              })
              .catch((err) => {
                flash(`delete failed: ${errorMessage(err)}`);
              });
            return;
          }
          setBatchDeleteConfirm(null);
          return;
        }
        if (input === 'd') {
          const hasRunning = selectedJobs.some((j) => j.status === 'running');
          if (hasRunning) {
            flash('cancel running tasks before deleting');
            return;
          }
          setBatchDeleteConfirm(selectedJobs.map((j) => j.id));
          return;
        }
        if (input === 'r') {
          const failed = selectedJobs.filter((j) => j.status === 'failed');
          const skipped = selectedJobs.length - failed.length;
          if (failed.length === 0) {
            flash('no failed tasks in selection');
            return;
          }
          getDb()
            .update(schema.jobs)
            .set({ status: 'queued', runAt: null })
            .where(
              inArray(
                schema.jobs.id,
                failed.map((j) => j.id),
              ),
            )
            .run();
          notifyChange();
          const msg = skipped > 0 ? `${failed.length} re-queued (${skipped} skipped)` : `${failed.length} re-queued`;
          flash(msg);
          setVisualAnchor(null);
          return;
        }
        if (input === 'c') {
          const queued = selectedJobs.filter((j) => j.status === 'queued');
          const running = selectedJobs.filter((j) => j.status === 'running');
          const skipped = selectedJobs.length - queued.length - running.length;
          if (queued.length === 0 && running.length === 0) {
            flash('no cancellable tasks in selection');
            return;
          }
          if (queued.length > 0) {
            getDb()
              .update(schema.jobs)
              .set({ status: 'cancelled' })
              .where(
                inArray(
                  schema.jobs.id,
                  queued.map((j) => j.id),
                ),
              )
              .run();
            notifyChange();
          }
          if (running.length > 0) {
            getDb()
              .update(schema.jobs)
              .set({ cancelRequestedAt: sql`(unixepoch())` })
              .where(
                inArray(
                  schema.jobs.id,
                  running.map((j) => j.id),
                ),
              )
              .run();
            notifyChange();
          }
          const parts: string[] = [];
          if (queued.length > 0) parts.push(`${queued.length} cancelled`);
          if (running.length > 0) parts.push(`${running.length} cancelling`);
          if (skipped > 0) parts.push(`${skipped} skipped`);
          flash(parts.join(', '));
          setVisualAnchor(null);
          return;
        }
        return;
      }

      if (key.escape) {
        setView('input');
        return;
      }
      if (key.return) {
        if (selectedJob) {
          setDetailOrigin('list');
          setView('detail');
        }
        return;
      }
      if (key.upArrow || input === 'k') {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setCursor((c) => Math.min(jobs.length - 1, c + 1));
        return;
      }
      if (input === 'v') {
        if (jobs.length > 0) setVisualAnchor(cursor);
        return;
      }
      if (input === 'f') {
        setFilterIdx((i) => (i + 1) % FILTERS.length);
        setCursor(0);
        return;
      }
      if (input === 'c') {
        if (!selectedJob) return;
        if (selectedJob.status === 'queued') {
          getDb().update(schema.jobs).set({ status: 'cancelled' }).where(eq(schema.jobs.id, selectedJob.id)).run();
          notifyChange();
          flash(`#${selectedJob.id} cancelled`);
        } else if (selectedJob.status === 'running') {
          getDb()
            .update(schema.jobs)
            .set({ cancelRequestedAt: sql`(unixepoch())` })
            .where(eq(schema.jobs.id, selectedJob.id))
            .run();
          notifyChange();
          flash(`#${selectedJob.id} cancelling...`);
        } else {
          flash('can only cancel queued or running tasks');
        }
        return;
      }
      if (input === 'r') {
        if (!selectedJob) return;
        if (selectedJob.status !== 'failed') {
          flash('can only retry failed tasks');
          return;
        }
        getDb()
          .update(schema.jobs)
          .set({ status: 'queued', runAt: null })
          .where(eq(schema.jobs.id, selectedJob.id))
          .run();
        notifyChange();
        flash(`#${selectedJob.id} re-queued`);
        return;
      }
      if (input === 'l') {
        if (!selectedJob) return;
        const text = `junior task logs ${selectedJob.id}`;
        copyToClipboard(text).then((ok) => {
          flash(ok ? `copied: ${text}` : 'clipboard failed');
        });
        return;
      }
      if (deleteConfirm !== null) {
        if (input === 'y') {
          const jobId = deleteConfirm;
          setDeleteConfirm(null);
          deleteJob(jobId)
            .then(() => {
              flash(`#${jobId} deleted`);
              notifyChange();
            })
            .catch((err) => {
              flash(`delete failed: ${errorMessage(err)}`);
            });
          return;
        }
        setDeleteConfirm(null);
        return;
      }
      if (input === 'd') {
        if (!selectedJob) return;
        if (pendingD) {
          if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
          setPendingD(false);
          if (selectedJob.status === 'running') {
            flash('cancel the task before deleting');
            return;
          }
          setDeleteConfirm(selectedJob.id);
          return;
        }
        setPendingD(true);
        pendingDTimer.current = setTimeout(() => setPendingD(false), DOUBLE_DELETE_TIMEOUT_MS);
        return;
      }
      if (pendingD) {
        setPendingD(false);
        if (pendingDTimer.current) clearTimeout(pendingDTimer.current);
      }
    }
  });

  const handleAddSubmit = useCallback(
    (value: string) => {
      const desc = value.trim();
      if (!desc) return;
      ensureInit();
      const db = getDb();
      const title = desc.split('\n')[0].slice(0, TITLE_MAX_LENGTH);
      const result = db
        .insert(schema.jobs)
        .values({ title, prompt: desc, repoPath: getRepoPath(), baseBranch })
        .returning()
        .get();
      setInputValue('');
      flash(`#${result.id} queued`);
    },
    [flash, baseBranch],
  );

  const handleSlashCommand = useCallback(
    (cmd: string): boolean => {
      const name = cmd.toLowerCase().replace(/\s+$/, '');
      if (name === '/quit' || name === '/exit' || name === '/q') {
        handleExit();
        return true;
      }
      if (name === '/tasks' || name === '/list') {
        setView('list');
        return true;
      }
      if (name === '/schedules') {
        setView('schedules');
        return true;
      }
      if (name === '/new-schedule') {
        setView('addSchedule');
        return true;
      }
      if (name === '/hooks') {
        setView('hooks');
        return true;
      }
      if (name === '/new-hook') {
        setView('addHook');
        return true;
      }
      if (name === '/daemon-start' || name === '/daemon start') {
        const { started, pid } = startDaemon();
        flash(started ? `daemon started (PID: ${pid})` : `daemon already running (PID: ${pid})`);
        return true;
      }
      if (name === '/daemon-stop' || name === '/daemon stop') {
        const { running } = isDaemonRunning();
        if (!running) {
          flash('daemon is not running');
          return true;
        }
        stopDaemon(() => flash('daemon stopped'));
        return true;
      }
      if (name === '/reset-exit') {
        setConfigValue('on_exit', 'ask');
        flash('on_exit reset to "ask"');
        return true;
      }
      flash(`unknown command: ${name}`);
      return true;
    },
    [handleExit, flash],
  );

  const handleScheduleSubmit = useCallback(
    (description: string) => {
      ensureInit();
      const db = getDb();
      const result = db
        .insert(schema.schedules)
        .values({ name: description.slice(0, 120), prompt: description, cron: '* * * * *', paused: 1 })
        .returning()
        .get();
      notifyChange();
      flash(`schedule #${result.id} created — extracting...`);
      setView('input');
      extractSchedule(description)
        .then((extracted) => {
          getDb()
            .update(schema.schedules)
            .set({ name: extracted.name, cron: extracted.cron, prompt: extracted.prompt, paused: 0 })
            .where(eq(schema.schedules.id, result.id))
            .run();
          notifyChange();
          flash(`schedule #${result.id} ready — press 3 to view`);
        })
        .catch((err) => {
          flash(`schedule #${result.id} extraction failed: ${errorMessage(err)}`);
        });
    },
    [flash],
  );

  const handleScheduleCancel = useCallback(() => {
    setView('input');
  }, []);

  const editSchedule = editScheduleId !== null ? (schedules.find((s) => s.id === editScheduleId) ?? null) : null;

  const handleEditScheduleSubmit = useCallback(
    (name: string, prompt: string, cron: string) => {
      if (editScheduleId === null) return;
      ensureInit();
      const db = getDb();
      db.update(schema.schedules).set({ name, prompt, cron }).where(eq(schema.schedules.id, editScheduleId)).run();
      notifyChange();
      flash(`schedule #${editScheduleId} updated`);
      if (editOrigin === 'scheduleDetail') {
        setView('scheduleDetail');
      } else {
        setView('schedules');
      }
      setEditScheduleId(null);
    },
    [editScheduleId, editOrigin, flash],
  );

  const handleEditScheduleCancel = useCallback(() => {
    if (editOrigin === 'scheduleDetail') {
      setView('scheduleDetail');
    } else {
      setView('schedules');
    }
    setEditScheduleId(null);
  }, [editOrigin]);

  const handleHookSubmit = useCallback(
    (description: string) => {
      ensureInit();
      const db = getDb();
      const result = db
        .insert(schema.hooks)
        .values({ name: description.slice(0, 120), checkFn: 'return false', prompt: description, paused: 1 })
        .returning()
        .get();
      notifyChange();
      flash(`hook #${result.id} created — extracting...`);
      setView('input');
      extractHook(description)
        .then((extracted) => {
          getDb()
            .update(schema.hooks)
            .set({ name: extracted.name, checkFn: extracted.checkFn, prompt: extracted.prompt, paused: 0 })
            .where(eq(schema.hooks.id, result.id))
            .run();
          notifyChange();
          flash(`hook #${result.id} ready — press 4 to view`);
        })
        .catch((err) => {
          flash(`hook #${result.id} extraction failed: ${errorMessage(err)}`);
        });
    },
    [flash],
  );

  const handleHookCancel = useCallback(() => {
    setView('input');
  }, []);

  const editHook = editHookId !== null ? (hooksList.find((h) => h.id === editHookId) ?? null) : null;

  const handleEditHookSubmit = useCallback(
    (name: string, prompt: string, checkFn: string) => {
      if (editHookId === null) return;
      ensureInit();
      const db = getDb();
      db.update(schema.hooks).set({ name, prompt, checkFn }).where(eq(schema.hooks.id, editHookId)).run();
      notifyChange();
      flash(`hook #${editHookId} updated`);
      if (editHookOrigin === 'hookDetail') {
        setView('hookDetail');
      } else {
        setView('hooks');
      }
      setEditHookId(null);
    },
    [editHookId, editHookOrigin, flash],
  );

  const handleEditHookCancel = useCallback(() => {
    if (editHookOrigin === 'hookDetail') {
      setView('hookDetail');
    } else {
      setView('hooks');
    }
    setEditHookId(null);
  }, [editHookOrigin]);

  const contentHeight = rows - 1;
  const hints = buildHints(
    view,
    filterIdx,
    exitRemember,
    inputMode,
    deleteConfirm,
    visualAnchor !== null,
    batchDeleteConfirm,
    schedDeleteConfirm,
    hookDeleteConfirm,
  );
  const inputWidth = Math.min(60, columns - 4);

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {view === 'exiting' ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center" justifyContent="center">
          <ExitDialog onConfirm={handleExitChoice} onCancel={handleExitCancel} onRememberChange={setExitRemember} />
        </Box>
      ) : view === 'input' ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center">
          <Box height={Math.max(0, Math.floor((contentHeight - 4) / 3))} />
          <Text bold>junior</Text>
          <Text dimColor>dev that never sleeps</Text>
          <Text dimColor>fire-and-forget, scheduled, or hook jobs</Text>
          <Box marginTop={1}>
            <AddTask
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleAddSubmit}
              onSlashCommand={handleSlashCommand}
              onModeChange={setInputMode}
              repoPath={getRepoPath()}
              width={inputWidth}
              focus={true}
              maxHeight={Math.max(3, Math.floor(contentHeight / 2))}
            />
          </Box>
        </Box>
      ) : view === 'addSchedule' ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center" justifyContent="center">
          <AddSchedule width={inputWidth} onSubmit={handleScheduleSubmit} onCancel={handleScheduleCancel} />
        </Box>
      ) : view === 'editSchedule' && editSchedule ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center" justifyContent="center">
          <EditSchedule
            key={editSchedule.id}
            width={inputWidth}
            onSubmit={handleEditScheduleSubmit}
            onCancel={handleEditScheduleCancel}
            initialName={editSchedule.name}
            initialPrompt={editSchedule.prompt}
            initialCron={editSchedule.cron}
            title={`edit schedule #${editSchedule.id}`}
          />
        </Box>
      ) : view === 'addHook' ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center" justifyContent="center">
          <AddHook width={inputWidth} onSubmit={handleHookSubmit} onCancel={handleHookCancel} />
        </Box>
      ) : view === 'editHook' && editHook ? (
        <Box height={contentHeight} flexDirection="column" alignItems="center" justifyContent="center">
          <EditHook
            key={editHook.id}
            width={inputWidth}
            onSubmit={handleEditHookSubmit}
            onCancel={handleEditHookCancel}
            initialName={editHook.name}
            initialPrompt={editHook.prompt}
            initialCheckFn={editHook.checkFn}
            title={`edit hook #${editHook.id}`}
          />
        </Box>
      ) : view === 'hookDetail' && activeDetailHook ? (
        <HookDetail
          hook={activeDetailHook}
          jobCursor={hookDetailJobCursor}
          height={contentHeight}
          width={columns}
          onJobCountChange={setHookDetailJobCount}
        />
      ) : view === 'hooks' ? (
        <HookList hooks={hooksList} cursor={hookCursor} height={contentHeight} width={columns} showCursor={true} />
      ) : view === 'scheduleDetail' && activeDetailSchedule ? (
        <ScheduleDetail
          schedule={activeDetailSchedule}
          jobCursor={schedDetailJobCursor}
          height={contentHeight}
          width={columns}
          onJobCountChange={setSchedDetailJobCount}
        />
      ) : view === 'schedules' ? (
        <ScheduleList
          schedules={schedules}
          cursor={scheduleCursor}
          height={contentHeight}
          width={columns}
          showCursor={true}
        />
      ) : view === 'detail' && activeDetailJob ? (
        <TaskDetail job={activeDetailJob} height={contentHeight} width={columns} />
      ) : (
        <TaskList
          jobs={jobs}
          cursor={cursor}
          height={contentHeight}
          width={columns}
          showCursor={true}
          selectedRange={selectedRange}
        />
      )}
      <StatusBar data={data} hints={hints} message={message} width={columns} />
    </Box>
  );
}

export async function renderTui() {
  const { waitUntilExit } = render(<App />, { exitOnCtrlC: false });
  await waitUntilExit();
}
