#!/usr/bin/env bash
# inventory-skills.sh — List existing skills with context budget usage
#
# Usage: inventory-skills.sh
#
# Scans ~/.claude/skills/ and .claude/skills/ for SKILL.md files.
# Outputs JSON with name, description, description_chars for each skill,
# plus total budget usage.

set -euo pipefail

SKILLS="[]"
TOTAL_CHARS=0
BUDGET=30000

# Function to extract frontmatter fields from a SKILL.md
extract_skill_info() {
    local file="$1"
    local name=""
    local description=""
    local in_frontmatter=false
    local in_description=false
    local desc_lines=""

    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            if $in_frontmatter; then
                break  # End of frontmatter
            else
                in_frontmatter=true
                continue
            fi
        fi

        if $in_frontmatter; then
            # Extract name
            if echo "$line" | grep -qE '^name:'; then
                name=$(echo "$line" | sed 's/^name:\s*//' | tr -d '"' | tr -d "'")
                in_description=false
            fi

            # Start of description (single line or multi-line)
            if echo "$line" | grep -qE '^description:'; then
                description=$(echo "$line" | sed 's/^description:\s*//' | tr -d '"' | tr -d "'")
                # Check for multi-line description marker
                if echo "$line" | grep -qE '^description:\s*[>|]'; then
                    description=""
                    in_description=true
                fi
            elif $in_description; then
                # Multi-line description continuation
                if echo "$line" | grep -qE '^\S' && ! echo "$line" | grep -qE '^\s'; then
                    in_description=false
                else
                    desc_lines="${desc_lines} $(echo "$line" | sed 's/^\s*//')"
                fi
            fi
        fi
    done < "$file"

    # Use accumulated multi-line description if single-line was empty
    if [[ -z "$description" && -n "$desc_lines" ]]; then
        description=$(echo "$desc_lines" | sed 's/^\s*//' | sed 's/\s*$//')
    fi

    # Use directory name if no name field
    if [[ -z "$name" ]]; then
        name=$(basename "$(dirname "$file")")
    fi

    local desc_chars=${#description}

    jq -n \
        --arg name "$name" \
        --arg description "$description" \
        --argjson desc_chars "$desc_chars" \
        --arg file "$file" \
        '{name: $name, description: $description, description_chars: $desc_chars, file: $file}'
}

# Scan personal skills
if [[ -d "${HOME}/.claude/skills" ]]; then
    while IFS= read -r skill_file; do
        info=$(extract_skill_info "$skill_file")
        chars=$(echo "$info" | jq '.description_chars')
        TOTAL_CHARS=$((TOTAL_CHARS + chars))
        SKILLS=$(echo "$SKILLS" | jq --argjson s "$info" '. + [$s + {scope: "personal"}]')
    done < <(find "${HOME}/.claude/skills" -name "SKILL.md" -type f 2>/dev/null)
fi

# Scan project skills
if [[ -d ".claude/skills" ]]; then
    while IFS= read -r skill_file; do
        info=$(extract_skill_info "$skill_file")
        chars=$(echo "$info" | jq '.description_chars')
        TOTAL_CHARS=$((TOTAL_CHARS + chars))
        SKILLS=$(echo "$SKILLS" | jq --argjson s "$info" '. + [$s + {scope: "project"}]')
    done < <(find ".claude/skills" -name "SKILL.md" -type f 2>/dev/null)
fi

# Output inventory
SKILL_COUNT=$(echo "$SKILLS" | jq 'length')
BUDGET_PCT=$(echo "scale=1; $TOTAL_CHARS * 100 / $BUDGET" | bc)

jq -n \
    --argjson skills "$SKILLS" \
    --argjson count "$SKILL_COUNT" \
    --argjson total_chars "$TOTAL_CHARS" \
    --argjson budget "$BUDGET" \
    --arg budget_pct "${BUDGET_PCT}%" \
    '{
        inventory: {
            skill_count: $count,
            total_description_chars: $total_chars,
            budget_limit: $budget,
            budget_usage: $budget_pct,
            budget_warning: ($total_chars > 25000),
            budget_exceeded: ($total_chars > 30000)
        },
        skills: $skills
    }'
