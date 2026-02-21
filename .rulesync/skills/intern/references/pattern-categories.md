# Pattern Categories Reference

Intern detects 4 categories of cross-session patterns. This reference details the
detection heuristics and scoring for each category.

## Category 1: Corrections

User correcting Claude's behavior or output.

### Detection Signals

**HIGH confidence (0.80-0.95)**

| Pattern | Regex | Confidence | Notes |
|---------|-------|-----------|-------|
| Remember prefix | `^remember:` | 0.95 | Explicit memory instruction |
| Guardrails | `don't add .+ unless\|only change what.s? asked\|leave .+ alone` | 0.90 | Scope boundary |
| Emphasis caps | `ALWAYS\|NEVER` (full caps) | 0.85 | Strong preference |

**MEDIUM confidence (0.55-0.80)**

| Pattern | Regex | Confidence | Notes |
|---------|-------|-----------|-------|
| No prefix | `^no,` | 0.75 | Direct rejection |
| Use instead | `don't use\|use .+ not .+\|use .+ instead of` | 0.70 | Tool/method preference |
| Actually prefix | `^actually,` | 0.60 | Gentle correction |
| I told you | `I told you\|I said\|I already` | 0.65 | Repeated correction |
| Stop doing | `stop doing\|quit\|enough with` | 0.60 | Frustration signal |

**LOW confidence (0.40-0.55)**

| Pattern | Regex | Confidence | Notes |
|---------|-------|-----------|-------|
| Suggestions | `try\|maybe\|consider\|what about` | 0.45 | Soft guidance |
| Questions | `have you considered` | 0.40 | Not always a correction |

### Confidence Adjustments

| Condition | Adjustment | Rationale |
|-----------|-----------|-----------|
| Message < 80 chars | +10% | Corrections tend to be terse |
| Message > 300 chars | -15% | Likely a task description |
| Ends with `?` | Skip | Likely a question |

### False Positive Filters

Skip messages that match:
- Questions (ends with `?`)
- Task requests (starts with "can you", "please", "I need you to")
- Error descriptions (contains stack traces, error codes)
- Bug reports (contains "I found a bug", "there's an issue")

## Category 2: Repetition

Same tool sequence appearing across multiple sessions.

### Detection Algorithm

1. Extract tool call names from assistant messages in order
2. Generate n-grams (window size 2-5)
3. Create fingerprints: `tool_name(param_pattern)` where param_pattern uses wildcards
   - `Read(*.config.*)` matches reading any config file
   - `Bash(npm *)` matches any npm command
   - `Edit(src/*.ts)` matches editing any TypeScript file in src
4. Count fingerprint occurrences across sessions
5. Threshold: >= 3 occurrences across >= 2 sessions

### Effort Score Estimation

| Sequence Length | Base Effort Score |
|----------------|-------------------|
| 2 tools | 2 |
| 3 tools | 4 |
| 4 tools | 6 |
| 5 tools | 8 |

Multiply by 1.5 if sequence includes Bash commands (higher automation value).

## Category 3: Friction

Long back-and-forth on tasks that should be straightforward.

### Detection Heuristics

**Task boundaries**: A new user message that is NOT:
- A follow-up correction (matches correction patterns above)
- A "yes"/"no"/"looks good" response
- A question about Claude's output

**Friction indicators**:
- \> 6 turns for a single logical task
- Multiple Edit calls to the same file (Claude iterating)
- Bash tool returning errors followed by more Bash calls
- User saying "not what I meant", "try again", "wrong"

### Scoring

```
friction_score = turns_to_completion * (1 + error_count * 0.2) * (1 + repeated_edits * 0.3)
```

Where `repeated_edits` = number of files edited more than twice in the task segment.

## Category 4: Manual Steps

Things the user describes doing manually that could be automated.

### Detection Signals

| Signal | Regex | Confidence |
|--------|-------|-----------|
| Manual action | `I manually\|I had to` | 0.70 |
| Habitual action | `I always do .+ before\|every time I` | 0.70 |
| Automation request | `can you automate` | 0.90 |
| Pre-task ritual | `before starting, I need to` | 0.65 |
| External tool | references to tools not in Claude Code | 0.50 |

## Cross-Category Scoring

Final score for all categories:

```
score = frequency * effort_score * confidence
```

| Component | Range | Description |
|-----------|-------|-------------|
| frequency | 1-N | Occurrences across sessions |
| effort_score | 1-10 | Estimated effort saved per occurrence |
| confidence | 0.0-1.0 | Detection confidence |

### Minimum Thresholds for Proposal Generation

- Score >= 5.0
- Frequency >= 2
- Occurrences across >= 2 sessions
- Confidence >= 0.55

Patterns below these thresholds are reported in the analysis but do not generate proposals.
