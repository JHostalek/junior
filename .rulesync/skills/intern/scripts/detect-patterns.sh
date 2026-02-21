#!/usr/bin/env bash
# detect-patterns.sh — Run regex-based correction detection on session transcripts
#
# Usage: detect-patterns.sh <session-jsonl-file>
#
# Reads a single session JSONL file and outputs detected correction patterns as JSON.
# This handles the fast regex pass. Semantic analysis is done by Claude in the skill.

set -euo pipefail

SESSION_FILE="${1:?Usage: detect-patterns.sh <session-jsonl-file>}"

if [[ ! -f "$SESSION_FILE" ]]; then
    echo '{"error": "Session file not found: '"$SESSION_FILE"'"}' >&2
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo '{"error": "jq is required"}' >&2
    exit 1
fi

# Extract user messages with timestamps
MESSAGES=$(jq -c '
    select(.type == "user")
    | {
        text: (if (.message.content | type) == "string" then .message.content else (.message.content[]? | select(.type == "text") | .text) end),
        timestamp: .timestamp,
        uuid: .uuid
    }
' "$SESSION_FILE" 2>/dev/null)

PATTERNS="[]"

while IFS= read -r msg_json; do
    [[ -z "$msg_json" ]] && continue

    text=$(echo "$msg_json" | jq -r '.text // ""')
    timestamp=$(echo "$msg_json" | jq -r '.timestamp // 0')
    uuid=$(echo "$msg_json" | jq -r '.uuid // ""')

    [[ -z "$text" ]] && continue

    # Calculate confidence adjustments
    text_len=${#text}
    confidence_adjust=0

    # Short messages are more likely corrections
    if [[ $text_len -lt 80 ]]; then
        confidence_adjust=10
    fi

    # Long messages are less likely corrections
    if [[ $text_len -gt 300 ]]; then
        confidence_adjust=-15
    fi

    # Skip questions
    if echo "$text" | grep -qE '\?\s*$'; then
        continue
    fi

    # HIGH confidence patterns (0.80-0.95)
    if echo "$text" | grep -qiE '^remember:'; then
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" \
            '. + [{"text": $t, "category": "correction", "confidence": 0.95, "pattern": "remember_prefix", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qiE "(don.t add .+ unless|only change what.s? asked|leave .+ alone)"; then
        conf=$(echo "90 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "guardrail", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qE "(ALWAYS|NEVER) "; then
        conf=$(echo "85 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "emphasis_caps", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    # MEDIUM confidence patterns (0.55-0.80)
    if echo "$text" | grep -qiE "^no,"; then
        conf=$(echo "75 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "no_prefix", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qiE "(don.t use|use .+ not .+|use .+ instead of|stop using)"; then
        conf=$(echo "70 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "use_not", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qiE "^actually,"; then
        conf=$(echo "60 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "actually_prefix", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qiE "(I told you|I said|I already)"; then
        conf=$(echo "65 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "i_told_you", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    if echo "$text" | grep -qiE "(stop doing|quit|enough with)"; then
        conf=$(echo "60 + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "correction", "confidence": ($c | tonumber), "pattern": "stop_doing", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

    # MANUAL STEP detection
    if echo "$text" | grep -qiE "(I manually|I had to|I always do .+ before|every time I|can you automate)"; then
        conf=70
        if echo "$text" | grep -qiE "can you automate"; then
            conf=90
        fi
        conf=$(echo "$conf + $confidence_adjust" | bc)
        conf_dec=$(echo "scale=2; $conf / 100" | bc)
        PATTERNS=$(echo "$PATTERNS" | jq --arg t "$text" --arg ts "$timestamp" --arg u "$uuid" --arg c "$conf_dec" \
            '. + [{"text": $t, "category": "manual_step", "confidence": ($c | tonumber), "pattern": "manual_step", "timestamp": $ts, "uuid": $u}]')
        continue
    fi

done <<< "$MESSAGES"

# Extract tool sequence for repetition analysis
TOOL_SEQUENCE=$(jq -r '
    select(.type == "assistant")
    | .message.content[]?
    | select(.type == "tool_use")
    | .name
' "$SESSION_FILE" 2>/dev/null | paste -sd',' -)

# Count errors for friction analysis
ERROR_COUNT=$(jq '[
    select(.type == "assistant")
    | .message.content[]?
    | select(.type == "tool_result" and .is_error == true)
] | length' "$SESSION_FILE" 2>/dev/null | jq -s 'add // 0')

# Count edits to same file (friction signal)
REPEATED_EDITS=$(jq -r '
    select(.type == "assistant")
    | .message.content[]?
    | select(.type == "tool_use" and .name == "Edit")
    | .input.file_path
' "$SESSION_FILE" 2>/dev/null | sort | uniq -c | sort -rn | awk '$1 > 2 {print $2}' | paste -sd',' -)

# Output results
jq -n \
    --argjson patterns "$PATTERNS" \
    --arg tool_sequence "$TOOL_SEQUENCE" \
    --argjson error_count "$ERROR_COUNT" \
    --arg repeated_edits "$REPEATED_EDITS" \
    --arg session_file "$SESSION_FILE" \
    '{
        session_file: $session_file,
        corrections: [$patterns[] | select(.category == "correction")],
        manual_steps: [$patterns[] | select(.category == "manual_step")],
        tool_sequence: ($tool_sequence | split(",")),
        error_count: $error_count,
        repeated_edit_files: ($repeated_edits | split(",") | map(select(. != ""))),
        friction_signals: {
            high_error_count: ($error_count > 3),
            repeated_file_edits: (($repeated_edits | split(",") | map(select(. != "")) | length) > 0)
        }
    }'
