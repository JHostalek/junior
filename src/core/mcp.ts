import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export interface McpStatus {
  available: boolean;
  configPath?: string;
}

const mcpConfigSchema = z.object({
  mcpServers: z.record(z.unknown()),
});

let cache: { repoPath: string; status: McpStatus } | undefined;

export function detectMcp(repoPath: string): McpStatus {
  if (cache && cache.repoPath === repoPath) return cache.status;

  const configPath = path.join(repoPath, '.mcp.json');
  let status: McpStatus;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = mcpConfigSchema.parse(JSON.parse(raw));
    status = parsed.mcpServers.junior !== undefined ? { available: true, configPath } : { available: false };
  } catch {
    status = { available: false };
  }

  cache = { repoPath, status };
  return status;
}

export function resetMcpCache(): void {
  cache = undefined;
}
