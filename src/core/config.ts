import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { type ZodError, z } from 'zod';
import { ConfigError } from './errors.js';
import { getConfigPath } from './paths.js';
import type { Config } from './types.js';

export function formatZodErrors(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

export const configSchema = z.object({
  max_concurrency: z.number().int().min(1).max(16),
  on_exit: z.enum(['ask', 'stop', 'keep']),
});

export const DEFAULT_CONFIG: Config = {
  max_concurrency: 2,
  on_exit: 'ask',
};

export function loadConfig(): Config {
  const configPath = getConfigPath();
  let fileConfig: Partial<Config> = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = YAML.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      fileConfig = parsed as Partial<Config>;
    }
  }
  const merged = { ...DEFAULT_CONFIG, ...fileConfig };
  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new ConfigError(`Invalid config: ${formatZodErrors(result.error)}`);
  }
  return result.data;
}

export function saveConfig(config: Config): void {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new ConfigError(`Invalid config: ${formatZodErrors(result.error)}`);
  }
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8');
}

export function getConfigValue(key: string): unknown {
  return (loadConfig() as unknown as Record<string, unknown>)[key];
}

export function setConfigValue(key: string, value: unknown): void {
  const config = { ...loadConfig(), [key]: value };
  saveConfig(config as Config);
}
