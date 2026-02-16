export const Flag = {
  claudePath: process.env.JUNIOR_CLAUDE_PATH ?? 'claude',
  debug: process.env.JUNIOR_DEBUG === '1',
} as const;
