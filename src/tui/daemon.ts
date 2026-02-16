import { DAEMON_STOP_POLL_MS, DAEMON_STOP_TIMEOUT_MS } from '@/core/constants.js';
import { errorMessage } from '@/core/errors.js';
import { warn } from '@/core/logger.js';
import { isDaemonRunning, isProcessRunning, removePidFile } from '@/daemon/pid.js';

export function startDaemon(): { started: boolean; pid?: number } {
  const { running, pid } = isDaemonRunning();
  if (running) return { started: false, pid: pid ?? undefined };
  const proc = Bun.spawn([process.execPath, 'daemon', '__run'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  });
  proc.unref();
  return { started: true, pid: proc.pid };
}

export function stopDaemon(onStopped: () => void) {
  const { running, pid } = isDaemonRunning();
  if (!running || !pid) {
    onStopped();
    return;
  }
  process.kill(pid, 'SIGTERM');
  const deadline = Date.now() + DAEMON_STOP_TIMEOUT_MS;
  const check = () => {
    if (!isProcessRunning(pid)) {
      removePidFile();
      onStopped();
    } else if (Date.now() < deadline) {
      setTimeout(check, DAEMON_STOP_POLL_MS);
    } else {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (err) {
        warn('SIGKILL to daemon failed', { pid, error: errorMessage(err) });
      }
      removePidFile();
      onStopped();
    }
  };
  setTimeout(check, DAEMON_STOP_POLL_MS);
}
