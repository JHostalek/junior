# Claude Code Session Format Reference

Quick reference for parsing Claude Code session transcripts.

## File Locations

```
~/.claude/
├── projects/
│   └── {encoded-project-path}/       # / in path becomes -
│       ├── sessions-index.json       # Session metadata index
│       └── {uuid}.jsonl              # Full conversation transcript
```

Path encoding: `/Users/user/Documents/myproject` -> `-Users-user-Documents-myproject`

## Sessions Index Structure

```json
{
  "version": 1,
  "originalPath": "/absolute/path/to/project",
  "entries": [
    {
      "sessionId": "uuid-string",
      "fullPath": "/absolute/path/to/session.jsonl",
      "fileMtime": 1768989134347,
      "firstPrompt": "the user's first message",
      "summary": "AI-generated summary",
      "messageCount": 7,
      "created": "2026-01-07T18:37:50.018Z",
      "modified": "2026-01-07T18:40:57.720Z",
      "gitBranch": "feature/branch-name",
      "projectPath": "/absolute/path/to/project"
    }
  ]
}
```

## JSONL Line Types

### User Message
```json
{
  "type": "user",
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": 1768989134347,
  "message": { "role": "user", "content": "the user's message text" }
}
```

### Assistant Message
```json
{
  "type": "assistant",
  "uuid": "...",
  "parentUuid": "...",
  "sessionId": "...",
  "timestamp": 1768989140000,
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "I'll help with that..." },
      { "type": "tool_use", "id": "toolu_...", "name": "Read", "input": { "file_path": "..." } },
      { "type": "tool_result", "tool_use_id": "toolu_...", "content": "file contents..." }
    ]
  }
}
```

## Content Block Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `text` | Plain text response | `text` |
| `tool_use` | Tool invocation | `name`, `input`, `id` |
| `tool_result` | Tool output | `tool_use_id`, `content` |

## Key Constraints

- Sessions auto-delete after 30 days (configurable via `cleanupPeriodDays`)
- Files can be multi-MB for long conversations
- Sessions may be written to concurrently (check file isn't locked)
- `parentUuid` creates a linked list of turns
- `isSidechain` indicates branched conversations (skip these for analysis)

## Extracting Patterns

### User Messages (for correction/manual step detection)
```bash
# Extract all user message text from a session
jq -r 'select(.type == "user") | .message.content' session.jsonl
```

### Tool Sequences (for repetition detection)
```bash
# Extract ordered tool call names
jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' session.jsonl
```

### Tool Errors (for friction detection)
```bash
# Find tool results with errors
jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_result" and .is_error == true)' session.jsonl
```
