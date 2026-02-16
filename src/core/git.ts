import fs from 'node:fs';
import path from 'node:path';
import { GitError } from './errors.js';
import { warn } from './logger.js';

export function validateBranchName(name: string): void {
  if (name === '' || name.startsWith('-') || /[..\s~^:\\]|\x00/.test(name)) {
    throw new GitError(`Invalid branch name "${name}"`);
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

async function exec(cmd: string, args: string[], options?: { cwd?: string }): Promise<ExecResult> {
  const proc = Bun.spawn([cmd, ...args], {
    cwd: options?.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new GitError(`${cmd} ${args.join(' ')} failed: ${stderr || `exit code ${exitCode}`}`);
  }
  return { stdout, stderr };
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await exec('git', ['-C', repoPath, 'symbolic-ref', 'refs/remotes/origin/HEAD']);
    const ref = stdout.trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    const { stdout } = await exec('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  }
}

export async function listTrackedFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoPath });
  return stdout.split('\n').filter(Boolean);
}

export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): Promise<void> {
  validateBranchName(branchName);
  validateBranchName(baseBranch);
  try {
    await exec('git', ['-C', repoPath, 'branch', '-D', branchName]);
  } catch {}

  await exec('git', ['-C', repoPath, 'worktree', 'add', worktreePath, '-b', branchName, baseBranch]);
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await exec('git', ['-C', repoPath, 'worktree', 'remove', worktreePath, '--force']);
}

export async function forceDeleteBranch(repoPath: string, branchName: string): Promise<void> {
  validateBranchName(branchName);
  await exec('git', ['-C', repoPath, 'branch', '-D', branchName]);
}

export async function pruneWorktrees(repoPath: string): Promise<void> {
  await exec('git', ['-C', repoPath, 'worktree', 'prune']);
}

export async function hasChanges(worktreePath: string): Promise<boolean> {
  const { stdout } = await exec('git', ['-C', worktreePath, 'status', '--porcelain']);
  return stdout.trim().length > 0;
}

export function generateBranchName(title: string, jobId: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `junior/${slug}-${jobId}`;
}

export function generateScheduledBranchName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `junior/${slug}-${ts}`;
}

export async function removeSymlinks(worktreePath: string): Promise<void> {
  let entries: string[];
  try {
    entries = fs.readdirSync(worktreePath);
  } catch (err) {
    warn('Failed to read worktree directory for symlink removal', {
      worktreePath,
      error: String(err),
    });
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(worktreePath, entry);
    try {
      const stat = fs.lstatSync(entryPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(entryPath);
      }
    } catch (err) {
      warn('Failed to remove symlink', {
        entryPath,
        error: String(err),
      });
    }
  }
}

export async function hasCommitsAhead(worktreePath: string, baseBranch: string): Promise<boolean> {
  validateBranchName(baseBranch);
  const { stdout } = await exec('git', ['-C', worktreePath, 'log', `${baseBranch}..HEAD`, '--oneline']);
  return stdout.trim().length > 0;
}

export async function stageAndCommit(worktreePath: string, message: string): Promise<void> {
  await exec('git', ['-C', worktreePath, 'add', '-A']);
  const dirty = await hasChanges(worktreePath);
  if (!dirty) return;
  await exec('git', ['-C', worktreePath, 'commit', '-m', message]);
}

export async function mergeBase(worktreePath: string, baseBranch: string): Promise<boolean> {
  validateBranchName(baseBranch);
  try {
    await exec('git', ['-C', worktreePath, 'merge', baseBranch, '--no-edit']);
    return true;
  } catch {
    return false;
  }
}

export async function stash(repoPath: string): Promise<boolean> {
  const dirty = await hasChanges(repoPath);
  if (!dirty) return false;
  await exec('git', ['-C', repoPath, 'stash', 'push', '-m', 'junior-autostash']);
  return true;
}

export async function stashPop(repoPath: string): Promise<void> {
  await exec('git', ['-C', repoPath, 'stash', 'pop']);
}

export async function mergeNoFf(repoPath: string, branchName: string, message: string): Promise<void> {
  validateBranchName(branchName);
  await exec('git', ['-C', repoPath, 'merge', '--no-ff', branchName, '-m', message]);
}

export async function checkout(repoPath: string, branch: string): Promise<void> {
  validateBranchName(branch);
  await exec('git', ['-C', repoPath, 'checkout', branch]);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await exec('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

export async function isMergeInProgress(repoPath: string): Promise<boolean> {
  const { stdout } = await exec('git', ['-C', repoPath, 'rev-parse', '--git-dir']);
  const gitDir = path.resolve(repoPath, stdout.trim());
  return fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
}

export async function abortMerge(repoPath: string): Promise<void> {
  await exec('git', ['-C', repoPath, 'merge', '--abort']);
}

export async function symlinkIgnored(repoPath: string, worktreePath: string): Promise<void> {
  let entries: string[];
  try {
    entries = fs.readdirSync(repoPath);
  } catch (err) {
    warn('Failed to read repo directory for symlinking', {
      repoPath,
      error: String(err),
    });
    return;
  }

  const candidates = entries.filter((entry) => {
    if (entry === '.git' || entry === '.junior') return false;
    return !fs.existsSync(path.join(worktreePath, entry));
  });

  if (candidates.length === 0) return;

  const proc = Bun.spawn(['git', '-C', repoPath, 'check-ignore', ...candidates], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, , exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0 && exitCode !== 1) return;

  const ignored = new Set(stdout.split('\n').filter(Boolean));
  for (const entry of ignored) {
    try {
      fs.symlinkSync(path.join(repoPath, entry), path.join(worktreePath, entry));
    } catch (err) {
      warn('Failed to create symlink for ignored file', {
        entry,
        error: String(err),
      });
    }
  }
}
