---
name: intern
description: >
  Analyze recent Claude Code sessions to detect recurring patterns and automatically
  write skill/rule improvements. Use when the user says "reflect", "what did I repeat",
  "analyze my sessions", "improve skills", "update rules", "intern observe", or when
  executed headlessly via Junior on a daily schedule. Spawns a multi-agent team to
  harvest transcripts, detect patterns, synthesize proposals, and write changes directly.
  Do NOT use for single-session memory capture or real-time corrections — this is for
  cross-session pattern analysis only.
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, Task
argument-hint: "[--days N] [--project path]"
---

# Intern — Cross-Session Pattern Detector & Skill Synthesizer

Intern analyzes recent Claude Code sessions, finds recurring patterns (corrections you
keep making, tool chains you repeat, friction points, manual steps), and writes concrete
skill or rule improvements directly. Designed to run autonomously via Junior's daily
schedule in an isolated git worktree — the worktree merge or PR is the review gate,
not an interactive approval prompt.

## Quick Reference

| Argument        | Default | Description                                      |
|-----------------|---------|--------------------------------------------------|
| `--days N`      | 3       | How many days of sessions to analyze             |
| `--project path`| cwd     | Limit analysis to a specific project path        |

## Execution Model

This skill is designed for **two modes**:

1. **Headless (primary)**: Scheduled daily via Junior. Runs in an isolated git worktree.
   Writes all changes directly. Junior handles worktree merge-back. The user reviews
   the merged diff or PR in the morning.

2. **Interactive (secondary)**: User invokes `/intern` manually. Same pipeline, same
   direct writes, but the user sees the changes in real-time and can `git diff` or
   undo after.

In both modes, there is NO interactive approval prompt. The skill writes changes and
commits them. The review gate is:
- **Headless**: Junior's worktree merge / PR review
- **Interactive**: The user's own `git diff` / `git reset` after execution

## Workflow

```
1. HARVEST    — Read session transcripts from ~/.claude/projects/
2. ANALYZE    — Detect 4 pattern types across sessions (parallel agents)
3. SYNTHESIZE — Generate validated skill/rule artifacts
4. WRITE      — Write changes to skill files, CLAUDE.md rules, commit
5. REPORT     — Log a summary of what was changed (stdout for Junior logs)
```

## Phase 1: Parse Arguments

Parse `$ARGUMENTS` for flags. Defaults:
- `days`: 3
- `project`: current working directory (encode path: `/` becomes `-`)

## Phase 2: Spawn Team

Use the Task tool to spawn teammates. The pipeline is sequential at the phase level
(harvest must complete before analysis) but parallelizes within each phase.

### Teammate: harvester
- **Subagent type**: `general-purpose`
- **Task**: Run `scripts/harvest-sessions.sh --days {N} --project {path}`. Parse the
  JSON output. For each session, also read the raw JSONL file and extract:
  - Full user message texts (for correction/manual-step detection)
  - Full tool_use sequences with parameter summaries (for repetition detection)
  - Error counts and repeated-edit files (for friction detection)
  Return all data as structured JSON.

### Teammate: pattern-detector
- **Subagent type**: `general-purpose`
- **Task**: Receives harvested session data. For each session JSONL file, run
  `scripts/detect-patterns.sh {file}` to get regex-based detections. Then perform
  semantic analysis on the aggregated results:
  - Cluster similar corrections across sessions
  - Build tool-chain fingerprints and count cross-session repetitions
  - Score friction by turn count and error density
  - Score manual steps by automation potential
  Compute final scores: `frequency * effort_score * confidence`
  Deduplicate and return top 10 patterns sorted by score.

### Teammate: synthesizer
- **Subagent type**: `general-purpose`
- **Task**: Receives high-scoring patterns. Run `scripts/inventory-skills.sh` to get
  current skill inventory and budget status. For each pattern:
  - Classify into output type (SKILL.md vs CLAUDE.md rule) per the classification table
  - Generate the artifact using `references/synthesis-template.md`
  - Validate using `scripts/validate-proposal.sh`
  - Check overlap against existing skills
  Return validated proposals ready to write.

### Coordination flow (you are the lead):

```
1. Spawn harvester → wait for results
2. Spawn pattern-detector with harvester output → wait for results
3. If 0 patterns above threshold → log "No actionable patterns" and stop
4. Spawn synthesizer with pattern data → wait for results
5. Write all validated proposals (Phase 4)
6. Commit changes (Phase 4)
7. Output summary report (Phase 5)
```

## Phase 3: Detection Details

Refer to `references/pattern-categories.md` for the full detection reference. Summary:

### Correction Detection
Regex-based (via `scripts/detect-patterns.sh`) plus semantic clustering:
- HIGH (0.80-0.95): `remember:`, guardrails, ALWAYS/NEVER caps
- MEDIUM (0.55-0.80): `no,` prefix, `use X not Y`, `actually,`, `I told you`
- Adjustments: short msgs +10%, long msgs -15%, skip questions

### Repetition Detection
Tool-chain n-gram fingerprinting:
- Extract tool sequences per session
- Generate 2-5 grams, fingerprint by name + param pattern
- Threshold: >=3 occurrences across >=2 sessions

### Friction Detection
Turn-count analysis per logical task:
- Flag tasks with >6 turns
- Signals: repeated edits to same file, Bash errors, "try again" messages

### Manual Step Detection
Keyword scanning in user messages:
- "I manually...", "I had to...", "every time I..."
- "Can you automate..." (highest signal, 0.90 confidence)

### Scoring and Thresholds

```
score = frequency * effort_score * confidence
```

Minimum thresholds for a pattern to generate a proposal:
- Score >= 5.0
- Frequency >= 2
- Occurrences across >= 2 sessions
- Confidence >= 0.55

## Phase 4: Write Changes

For each validated proposal, write directly:

### New Skills
```bash
# Create skill directory and write SKILL.md
mkdir -p {skills_dir}/{skill-name}/
# Write SKILL.md using the Write tool
```

Target directory priority:
1. If in a git repo with `.rulesync/skills/`: write to `.rulesync/skills/{name}/SKILL.md`
2. Otherwise: write to `~/.claude/skills/{name}/SKILL.md`

### CLAUDE.md Rules
Append rules to the appropriate file using Edit:

| Rule scope | Target file |
|-----------|-------------|
| Universal behavior | `~/.claude/CLAUDE.md` |
| Project-specific | `.rulesync/rules/{topic}.md` |
| Path-scoped | `.rulesync/rules/{path}-{topic}.md` |

When appending, respect the existing file structure. Add a section header if one
doesn't exist for the rule category. Include an HTML comment with provenance metadata:

```markdown
## Variable Declarations
- Always use `const` by default. Only use `let` when reassignment is required.
<!-- intern: pattern="const-over-let" freq=5 confidence=0.85 date=2026-02-21 -->
```

### Skill Updates / Consolidations
- For overlapping skills (>70% overlap): merge into a single skill, delete the redundant one
- For stale skills (unused >14 days): add a `<!-- intern: stale, last_used=... -->` comment
  but do NOT delete — leave deletion for human review

### Commit
After all writes, create a single git commit:

```bash
git add -A
git commit -m "intern: {summary of changes}

Patterns detected: {count}
Skills added: {list}
Rules added: {list}
Skills consolidated: {list}
Budget: {current}/{max} chars ({pct}%)

Source sessions: {count} sessions over {days} days"
```

Do NOT push. Junior handles the worktree merge and any push operations.

## Phase 5: Report

Output a structured summary to stdout. This becomes the Junior task log:

```
=== Intern Analysis Complete ===

Sessions analyzed: {count} (last {days} days)
Patterns detected: {count} ({above_threshold} above threshold)

Changes written:
  [+] New skill: config-edit-test (.rulesync/skills/config-edit-test/SKILL.md)
  [+] New rule: "Use const over let" (.rulesync/rules/intern-generated.md)
  [+] New rule: "Run lint before commit" (.rulesync/rules/intern-generated.md)
  [~] Consolidated: css-helper + tailwind-setup → tailwind-styles
  [!] Flagged stale: old-formatter (unused 21 days)

Budget: 4,580/30,000 chars (15%) | Skills: 9/25

Commit: abc1234 "intern: add 1 skill, 2 rules, consolidate 1"
```

If no actionable patterns were found:

```
=== Intern Analysis Complete ===

Sessions analyzed: {count} (last {days} days)
Patterns detected: 0 above threshold

No changes written. All good!
```

## Constraints

- Do NOT prompt for user approval — write changes directly (the worktree/PR is the review gate)
- Do NOT push to remote — Junior handles push and merge operations
- Do NOT exceed the 30,000 char context budget for skill descriptions
- Do NOT re-propose patterns that were previously dismissed (check for
  `<!-- intern: dismissed -->` comments in existing files)
- Do NOT analyze sessions older than 30 days (they may be auto-deleted)
- Do NOT read session files that are currently being written to (skip files with
  modification time within the last 60 seconds)
- Do NOT include sensitive data (API keys, passwords, tokens) in pattern evidence
  or generated skills
- Do NOT generate skills for one-off issues — require minimum 2 occurrences across
  2+ sessions
- Do NOT delete existing skills — only flag as stale with a comment. Deletion is
  a human decision.
- Do NOT modify skills that have a `<!-- intern: pinned -->` comment — the user has
  explicitly protected these from automated changes

## When to Use / When NOT to Use

| Use When                                          | Don't Use When                                    |
|---------------------------------------------------|---------------------------------------------------|
| Scheduled daily via Junior (primary use case)      | Mid-task when you want immediate help              |
| Manual end-of-day reflection                       | For single-session memory/diary capture            |
| When skill inventory feels stale or bloated        | When you need real-time correction (use `/reflect`)|
| After a productive week with many sessions         | For one-off debugging or exploration               |
| When onboarding to understand team patterns        | When session history has <3 sessions               |

## Provenance

This skill implements the Intern design specification. For full architecture details,
see the `docs/` directory in the Intern repository.

Built from analysis of: claude-reflect-system, claude-md-improver (Anthropic official),
claude-memory-bank, claude-supermemory, and the Claude Diary pattern.
