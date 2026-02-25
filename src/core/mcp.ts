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

export function detectMcp(repoPath: string): McpStatus {
  const configPath = path.join(repoPath, '.mcp.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = mcpConfigSchema.parse(JSON.parse(raw));
    return parsed.mcpServers.junior !== undefined ? { available: true, configPath } : { available: false };
  } catch {
    return { available: false };
  }
}
