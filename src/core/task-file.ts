import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { formatZodErrors } from './config.js';
import { errorMessage, TaskFileError } from './errors.js';
import { resolvePath } from './paths.js';

export const taskFileSchema = z.object({
  title: z.string().min(1, 'title is required'),
  repo: z.string().min(1, 'repo is required'),
  prompt: z.string().min(1, 'prompt is required'),
  base_branch: z.string().optional(),
});

export type TaskFile = z.infer<typeof taskFileSchema>;

export async function parseTaskFile(filePath: string): Promise<TaskFile> {
  const resolved = resolvePath(filePath);

  if (!fs.existsSync(resolved)) {
    throw new TaskFileError(`Task file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    throw new TaskFileError(`Failed to parse YAML in ${resolved}: ${errorMessage(err)}`);
  }

  const result = taskFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new TaskFileError(`Invalid task file ${resolved}: ${formatZodErrors(result.error)}`);
  }

  const taskFile = result.data;

  const repoPath = resolvePath(taskFile.repo);
  if (!fs.existsSync(repoPath)) {
    throw new TaskFileError(`Repo path does not exist: ${repoPath}`);
  }
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    throw new TaskFileError(`Repo path is not a git repository (no .git directory): ${repoPath}`);
  }

  return taskFile;
}
