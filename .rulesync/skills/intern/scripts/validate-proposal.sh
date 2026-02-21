#!/usr/bin/env bash
# validate-proposal.sh — Validate a proposed SKILL.md against the 9 quality constraints
#
# Usage: validate-proposal.sh <skill-md-file>
#
# Outputs JSON with pass/fail for each constraint and an overall result.

set -euo pipefail

SKILL_FILE="${1:?Usage: validate-proposal.sh <skill-md-file>}"

if [[ ! -f "$SKILL_FILE" ]]; then
    echo '{"error": "File not found: '"$SKILL_FILE"'"}' >&2
    exit 1
fi

PASS=true
RESULTS="[]"

add_result() {
    local name="$1"
    local passed="$2"
    local detail="$3"

    RESULTS=$(echo "$RESULTS" | jq \
        --arg name "$name" \
        --argjson passed "$passed" \
        --arg detail "$detail" \
        '. + [{"constraint": $name, "passed": $passed, "detail": $detail}]')

    if [[ "$passed" == "false" ]]; then
        PASS=false
    fi
}

# Separate frontmatter from body
IN_FRONTMATTER=false
FRONTMATTER_DONE=false
DESCRIPTION=""
BODY=""

while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
        if $IN_FRONTMATTER; then
            FRONTMATTER_DONE=true
            IN_FRONTMATTER=false
        elif ! $FRONTMATTER_DONE; then
            IN_FRONTMATTER=true
        else
            BODY="${BODY}${line}"$'\n'
        fi
        continue
    fi

    if $IN_FRONTMATTER; then
        # Accumulate description (simple extraction)
        if echo "$line" | grep -qiE '^description:'; then
            DESCRIPTION=$(echo "$line" | sed 's/^[Dd]escription:\s*//')
        elif [[ -n "$DESCRIPTION" ]] && echo "$line" | grep -qE '^\s'; then
            DESCRIPTION="${DESCRIPTION} $(echo "$line" | sed 's/^\s*//')"
        fi
    elif $FRONTMATTER_DONE; then
        BODY="${BODY}${line}"$'\n'
    fi
done < "$SKILL_FILE"

# Clean up description (remove quotes and multi-line markers)
DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/^[">|]\s*//' | sed 's/"\s*$//' | tr -s ' ')

# --- Constraint 1: Description <= 100 words ---
DESC_WORDS=$(echo "$DESCRIPTION" | wc -w | tr -d ' ')
if [[ "$DESC_WORDS" -le 100 ]]; then
    add_result "description_word_limit" "true" "${DESC_WORDS} words (limit: 100)"
else
    add_result "description_word_limit" "false" "${DESC_WORDS} words exceeds 100 word limit"
fi

# --- Constraint 2: Description contains trigger info ---
if echo "$DESCRIPTION" | grep -qiE '(when|use .* when|if .* asks|triggered by|invoke)'; then
    add_result "description_has_triggers" "true" "Contains trigger/routing info"
else
    add_result "description_has_triggers" "false" "Description lacks trigger phrases (when to use)"
fi

# --- Constraint 3: Body < 5,000 words ---
BODY_WORDS=$(echo "$BODY" | wc -w | tr -d ' ')
if [[ "$BODY_WORDS" -lt 5000 ]]; then
    add_result "body_word_limit" "true" "${BODY_WORDS} words (limit: 5,000)"
else
    add_result "body_word_limit" "false" "${BODY_WORDS} words exceeds 5,000 word limit"
fi

# --- Constraint 4: Has negative constraints ---
if echo "$BODY" | grep -qiE '(Do NOT|Don.t|NEVER|Must not)'; then
    NEG_COUNT=$(echo "$BODY" | grep -ciE '(Do NOT|Don.t|NEVER|Must not)' || echo "0")
    add_result "negative_constraints" "true" "Found ${NEG_COUNT} negative constraint(s)"
else
    add_result "negative_constraints" "false" "No explicit negative constraints found"
fi

# --- Constraint 5: Has disambiguation table ---
if echo "$BODY" | grep -qiE '(When to Use|When NOT|Don.t Use When)'; then
    add_result "disambiguation_table" "true" "Contains use/don't-use disambiguation"
else
    add_result "disambiguation_table" "false" "Missing When to Use / When NOT to Use table"
fi

# --- Constraint 6: Runtime gating if platform-specific ---
PLATFORM_TOOLS=$(echo "$BODY" | grep -oiE '(brew |apt-get |apt |pbcopy|pbpaste|xclip|wslpath|cmd\.exe)' | head -5 || echo "")
if [[ -n "$PLATFORM_TOOLS" ]]; then
    if echo "$BODY" | grep -qE '(uname|OSTYPE|platform|runtime)'; then
        add_result "runtime_gating" "true" "Platform-specific tools detected with runtime check"
    else
        add_result "runtime_gating" "false" "Platform tools (${PLATFORM_TOOLS}) found without runtime gating"
    fi
else
    add_result "runtime_gating" "true" "No platform-specific tools detected (gating not needed)"
fi

# --- Constraint 7: No nested parameter schemas ---
# Simple heuristic: check for deeply nested JSON-like structures in tool definitions
if echo "$BODY" | grep -qE '\{[^}]*\{[^}]*\{'; then
    add_result "flat_schemas" "false" "Possible nested parameter schema detected"
else
    add_result "flat_schemas" "true" "No nested schemas detected"
fi

# --- Constraint 8: Confirmation for destructive operations ---
DESTRUCTIVE=$(echo "$BODY" | grep -oiE '(rm -|git push|git push --force|deploy|drop table|delete|destroy|overwrite)' | head -5 || echo "")
if [[ -n "$DESTRUCTIVE" ]]; then
    if echo "$BODY" | grep -qiE '(confirm|approval|approve|preview|review before|ask .* before)'; then
        add_result "destructive_confirmation" "true" "Destructive ops (${DESTRUCTIVE}) have confirmation gates"
    else
        add_result "destructive_confirmation" "false" "Destructive ops (${DESTRUCTIVE}) found without confirmation step"
    fi
else
    add_result "destructive_confirmation" "true" "No destructive operations detected"
fi

# --- Constraint 9: Context budget check ---
DESC_CHARS=${#DESCRIPTION}
add_result "context_budget" "true" "Description is ${DESC_CHARS} chars (run inventory-skills.sh for total budget check)"

# Output results
PASS_COUNT=$(echo "$RESULTS" | jq '[.[] | select(.passed == true)] | length')
FAIL_COUNT=$(echo "$RESULTS" | jq '[.[] | select(.passed == false)] | length')

jq -n \
    --argjson results "$RESULTS" \
    --argjson all_passed "$PASS" \
    --argjson pass_count "$PASS_COUNT" \
    --argjson fail_count "$FAIL_COUNT" \
    --arg file "$SKILL_FILE" \
    '{
        file: $file,
        all_passed: $all_passed,
        passed: $pass_count,
        failed: $fail_count,
        constraints: $results
    }'
