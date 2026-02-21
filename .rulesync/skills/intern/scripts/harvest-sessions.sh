#!/usr/bin/env bash
# harvest-sessions.sh — Find and extract recent Claude Code session data
#
# Usage: harvest-sessions.sh [--days N] [--project PATH]
#
# Outputs JSON array of session summaries to stdout.
# Each summary includes session ID, message count, user messages, and tool sequences.

set -euo pipefail

DAYS=3
PROJECT_FILTER=""
CLAUDE_DIR="${HOME}/.claude"
PROJECTS_DIR="${CLAUDE_DIR}/projects"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --days)
            DAYS="$2"
            shift 2
            ;;
        --project)
            PROJECT_FILTER="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

# Check dependencies
if ! command -v jq &>/dev/null; then
    echo '{"error": "jq is required but not installed. Install with: brew install jq (macOS) or apt-get install jq (Linux)"}' >&2
    exit 1
fi

if [[ ! -d "$PROJECTS_DIR" ]]; then
    echo '{"error": "No Claude Code projects directory found at '"$PROJECTS_DIR"'"}' >&2
    exit 1
fi

# Calculate cutoff timestamp (N days ago in epoch milliseconds)
if [[ "$(uname)" == "Darwin" ]]; then
    CUTOFF=$(date -v-"${DAYS}"d +%s)
else
    CUTOFF=$(date -d "${DAYS} days ago" +%s)
fi

# Encode project path for directory matching (/ becomes -)
encode_path() {
    echo "$1" | sed 's|^/|-|' | sed 's|/|-|g'
}

# Find session files
SESSIONS_JSON="[]"
SESSION_COUNT=0

for project_dir in "$PROJECTS_DIR"/*/; do
    [[ -d "$project_dir" ]] || continue

    # Filter by project if specified
    if [[ -n "$PROJECT_FILTER" ]]; then
        encoded=$(encode_path "$PROJECT_FILTER")
        dir_name=$(basename "$project_dir")
        [[ "$dir_name" == *"$encoded"* ]] || continue
    fi

    # Find .jsonl files modified within the lookback window
    while IFS= read -r session_file; do
        [[ -f "$session_file" ]] || continue

        # Check file modification time
        if [[ "$(uname)" == "Darwin" ]]; then
            file_mtime=$(stat -f %m "$session_file")
        else
            file_mtime=$(stat -c %Y "$session_file")
        fi

        [[ "$file_mtime" -lt "$CUTOFF" ]] && continue

        session_id=$(basename "$session_file" .jsonl)

        # Skip if it looks like a UUID directory (subagent sessions)
        [[ -d "${session_file%.jsonl}" ]] && continue

        # Extract user messages
        user_messages=$(jq -c '[
            select(.type == "user")
            | {
                text: (if (.message.content | type) == "string" then .message.content else (.message.content[]? | select(.type == "text") | .text) end),
                timestamp: .timestamp
            }
        ]' "$session_file" 2>/dev/null | jq -s 'add // []')

        # Extract tool call sequences
        tool_sequence=$(jq -r '
            select(.type == "assistant")
            | .message.content[]?
            | select(.type == "tool_use")
            | .name
        ' "$session_file" 2>/dev/null | paste -sd',' - || echo "")

        # Extract tool errors
        error_count=$(jq '[
            select(.type == "assistant")
            | .message.content[]?
            | select(.type == "tool_result" and .is_error == true)
        ] | length' "$session_file" 2>/dev/null | jq -s 'add // 0')

        # Count messages
        msg_count=$(wc -l < "$session_file" | tr -d ' ')

        # Build session summary
        session_json=$(jq -n \
            --arg id "$session_id" \
            --arg project "$(basename "$project_dir")" \
            --argjson user_messages "$user_messages" \
            --arg tool_sequence "$tool_sequence" \
            --argjson error_count "$error_count" \
            --argjson msg_count "$msg_count" \
            --arg file "$session_file" \
            '{
                session_id: $id,
                project: $project,
                message_count: $msg_count,
                user_messages: $user_messages,
                tool_sequence: ($tool_sequence | split(",")),
                error_count: $error_count,
                file: $file
            }')

        SESSIONS_JSON=$(echo "$SESSIONS_JSON" | jq --argjson s "$session_json" '. + [$s]')
        SESSION_COUNT=$((SESSION_COUNT + 1))

    done < <(find "$project_dir" -maxdepth 1 -name "*.jsonl" -type f 2>/dev/null)
done

# Output summary
jq -n \
    --argjson sessions "$SESSIONS_JSON" \
    --argjson count "$SESSION_COUNT" \
    --argjson days "$DAYS" \
    '{
        harvest_summary: {
            sessions_found: $count,
            lookback_days: $days,
            timestamp: (now | todate)
        },
        sessions: $sessions
    }'
