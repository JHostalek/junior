export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'timeout' | 'cancelled';

export type { TaskFile } from './task-file.js';

export type OnExitBehavior = 'ask' | 'stop' | 'keep';

export interface Config {
  max_concurrency: number;
  on_exit: OnExitBehavior;
}

export interface ClaudeUsage {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ClaudeResult {
  result: string;
  session_id: string;
  usage: ClaudeUsage;
}

export interface HookContext {
  git(...args: string[]): Promise<string>;
  readFile(path: string): Promise<string>;
  exec(cmd: string, args: string[]): Promise<string>;
  state: Record<string, unknown>;
  repoPath: string;
}
