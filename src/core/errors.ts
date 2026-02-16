export class JuniorError extends Error {
  constructor(message: string, name = 'JuniorError') {
    super(message);
    this.name = name;
  }
}

export class TaskFileError extends JuniorError {
  constructor(message: string) {
    super(message, 'TaskFileError');
  }
}

export class GitError extends JuniorError {
  constructor(message: string) {
    super(message, 'GitError');
  }
}

export class ConfigError extends JuniorError {
  constructor(message: string) {
    super(message, 'ConfigError');
  }
}

export class ClaudeError extends JuniorError {
  constructor(message: string) {
    super(message, 'ClaudeError');
  }
}

export class DaemonError extends JuniorError {
  constructor(message: string) {
    super(message, 'DaemonError');
  }
}

export class CancelledError extends JuniorError {
  constructor(message: string) {
    super(message, 'CancelledError');
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
