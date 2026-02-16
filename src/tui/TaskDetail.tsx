import fs from 'node:fs';
import { desc, eq } from 'drizzle-orm';
import { Box, Text, useInput } from 'ink';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import wrapAnsi from 'wrap-ansi';
import { getDb, schema } from '@/db/index.js';
import type { Job, Run } from './hooks.js';

interface Props {
  job: Job;
  height: number;
  width: number;
}

function getRuns(jobId: number): Run[] {
  return getDb().select().from(schema.runs).where(eq(schema.runs.jobId, jobId)).orderBy(desc(schema.runs.id)).all();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

function formatStatsLine(runs: Run[], now: number): string | null {
  const parts: string[] = [];

  let totalCost = 0;
  let totalTokens = 0;
  let totalElapsed = 0;
  for (const r of runs) {
    totalCost += r.costUsd ?? 0;
    totalTokens += (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
    const end = r.finishedAt ?? now;
    if (r.startedAt) totalElapsed += Math.max(0, end - r.startedAt);
  }

  if (totalCost > 0) parts.push(`$${totalCost.toFixed(2)}`);
  if (totalTokens > 0) parts.push(formatTokens(totalTokens));
  if (totalElapsed > 0) parts.push(formatDuration(totalElapsed));

  return parts.length > 0 ? parts.join(' | ') : null;
}

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}

function toolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
      return stripWorktree(String(input.file_path ?? ''));
    case 'Write':
      return stripWorktree(String(input.file_path ?? ''));
    case 'Edit':
      return stripWorktree(String(input.file_path ?? ''));
    case 'Glob':
      return String(input.pattern ?? '');
    case 'Grep':
      return String(input.pattern ?? '');
    case 'Bash':
      return String(input.description || input.command || '');
    case 'Task':
      return String(input.description || '');
    case 'WebSearch':
      return String(input.query ?? '');
    case 'WebFetch':
      return String(input.url ?? '');
    default:
      return '';
  }
}

function stripWorktree(p: string): string {
  return p.replace(/\.junior\/worktrees\/job-\d+\//, '');
}

function parseActivity(logFile: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(logFile, 'utf-8');
  } catch {
    return [];
  }

  const lines: string[] = [];
  for (const raw of content.split('\n')) {
    if (!raw) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue;
    }

    if (obj.type === 'assistant') {
      const msg = obj.message as Record<string, unknown> | undefined;
      const contentArr = msg?.content as Array<Record<string, unknown>> | undefined;
      if (!contentArr) continue;
      for (const block of contentArr) {
        if (block.type === 'text') {
          const text = String(block.text ?? '').trim();
          if (text) {
            const first = text.split('\n')[0];
            lines.push(first);
          }
        } else if (block.type === 'tool_use') {
          const name = String(block.name ?? '');
          const input = (block.input as Record<string, unknown>) ?? {};
          const detail = toolSummary(name, input);
          lines.push(detail ? `${name} ${detail}` : name);
        }
      }
    }
  }
  return lines;
}

export function TaskDetail({ job, height, width }: Props) {
  const [scroll, setScroll] = useState(0);
  const [runs, setRuns] = useState<Run[]>(() => getRuns(job.id));
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [activity, setActivity] = useState<string[]>([]);
  const [wrapMode, setWrapMode] = useState<'truncate' | 'wrap'>('truncate');

  const run = runs[0] ?? null;

  const refresh = useCallback(() => {
    const r = getRuns(job.id);
    setRuns(r);
    if (r[0]?.logFile) setActivity(parseActivity(r[0].logFile));
    else setActivity([]);
  }, [job.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (job.status !== 'running') return;
    const interval = setInterval(() => {
      refresh();
      setNow(Math.floor(Date.now() / 1000));
    }, 3000);
    return () => clearInterval(interval);
  }, [job.status, refresh]);

  const contentWidth = Math.max(1, width - 2);

  const lines = useMemo(() => {
    const out: { label?: string; text: string; color?: string; markdown?: boolean }[] = [];

    if (job.branch) out.push({ label: 'branch', text: job.branch });

    if (run) {
      out.push({ text: '' });
      const statsParts = [`#${run.attempt}`];
      const metrics = formatStatsLine(runs, now);
      if (metrics) statsParts.push(metrics);
      out.push({ label: 'stats', text: statsParts.join(' | ') });
    }

    out.push({ text: '' });
    out.push({ label: 'prompt', text: '' });
    for (const line of job.prompt.split('\n')) {
      out.push({ text: `  ${line}` });
    }

    if (run) {
      if (run.result) {
        out.push({ text: '' });
        out.push({ label: 'result', text: '' });
        for (const line of run.result.split('\n')) {
          out.push({ text: `  ${line}`, markdown: true });
        }
      }

      if (activity.length > 0) {
        out.push({ text: '' });
        out.push({ label: 'activity', text: '' });
        for (const line of activity) {
          out.push({ text: `  ${line}`, color: 'gray', markdown: true });
        }
      }

      if (run.errorMessage) {
        out.push({ text: '' });
        out.push({ label: 'error', text: '' });
        for (const line of run.errorMessage.split('\n')) {
          out.push({ text: `  ${line}`, color: 'red', markdown: true });
        }
      }
    }

    if (wrapMode === 'truncate') return out;

    const wrapped: typeof out = [];
    for (const line of out) {
      if (!line.text) {
        wrapped.push(line);
        continue;
      }
      const labelPrefix = line.label ? `${line.label}: ` : '';
      const availableWidth = Math.max(1, contentWidth - labelPrefix.length);
      const result = wrapAnsi(line.text, availableWidth, { hard: true, trim: false });
      const subLines = result.split('\n');
      for (let i = 0; i < subLines.length; i++) {
        if (i === 0) {
          wrapped.push({ ...line, text: subLines[i] });
        } else {
          const padding = ' '.repeat(labelPrefix.length);
          wrapped.push({ text: `${padding}${subLines[i]}`, color: line.color, markdown: line.markdown });
        }
      }
    }
    return wrapped;
  }, [job, runs, now, activity, run, wrapMode, contentWidth]);

  const viewHeight = Math.max(height - 2, 1);
  const maxScroll = Math.max(0, lines.length - viewHeight);

  const halfPage = Math.max(1, Math.floor(viewHeight / 2));

  useInput((_input, key) => {
    if (key.upArrow || _input === 'k') {
      setScroll((s) => Math.max(0, s - 1));
    } else if (key.downArrow || _input === 'j') {
      setScroll((s) => Math.min(maxScroll, s + 1));
    } else if (_input === 'g') {
      setScroll(0);
    } else if (_input === 'G') {
      setScroll(maxScroll);
    } else if (key.ctrl && _input === 'd') {
      setScroll((s) => Math.min(maxScroll, s + halfPage));
    } else if (key.ctrl && _input === 'u') {
      setScroll((s) => Math.max(0, s - halfPage));
    } else if (_input === 'w') {
      setWrapMode((m) => (m === 'truncate' ? 'wrap' : 'truncate'));
      setScroll(0);
    }
  });

  const visible = lines.slice(scroll, scroll + viewHeight);

  return (
    <Box flexDirection="column" paddingX={1} height={height} width={width}>
      <Box>
        <Text wrap="truncate">
          <Text dimColor>task #{job.id} | </Text>
          <Text color={statusColor(job.status)}>{job.status}</Text>
          <Text dimColor> | {formatTimestamp(job.createdAt)}</Text>
        </Text>
      </Box>
      {visible.map((line, i) => (
        <Box key={i}>
          {line.label ? (
            <Text wrap="truncate">
              <Text dimColor>{line.label}: </Text>
              <Text color={line.color}>{line.text}</Text>
            </Text>
          ) : line.markdown ? (
            <MarkdownLine text={line.text} color={line.color} />
          ) : (
            <Text wrap="truncate" color={line.color}>
              {line.text}
            </Text>
          )}
        </Box>
      ))}
      <Box>
        <Text dimColor>
          {scroll > 0 ? '↑' : ' '}
          {scroll < maxScroll ? '↓' : ' '}
        </Text>
      </Box>
    </Box>
  );
}

function MarkdownLine({ text, color }: { text: string; color?: string }): ReactNode {
  const heading = text.match(/^(#{1,3})\s+(.*)/);
  if (heading) {
    return (
      <Text wrap="truncate" bold color={color}>
        {heading[2]}
      </Text>
    );
  }

  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(
        <Text key={key++} color={color}>
          {text.slice(last, match.index)}
        </Text>,
      );
    }
    if (match[1] !== undefined) {
      parts.push(
        <Text key={key++} bold color={color}>
          {match[1]}
        </Text>,
      );
    } else if (match[2] !== undefined) {
      parts.push(
        <Text key={key++} color={color} dimColor>
          {match[2]}
        </Text>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(
      <Text key={key++} color={color}>
        {text.slice(last)}
      </Text>,
    );
  }

  if (parts.length === 0)
    return (
      <Text wrap="truncate" color={color}>
        {text}
      </Text>
    );
  return <Text wrap="truncate">{parts}</Text>;
}

function statusColor(status: string): string | undefined {
  const map: Record<string, string> = {
    queued: 'yellow',
    running: 'cyan',
    done: 'green',
    failed: 'red',
    cancelled: 'gray',
  };
  return map[status];
}
