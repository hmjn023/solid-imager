---
name: read-memories
description: Search past coding-agent session logs to recall prior decisions, patterns, or unresolved work. Use when the user asks what was done before, refers to a past conversation, or prior project context is needed.
---

Search past session logs silently — do NOT narrate the process. Absorb the results and continue with enriched context.

`$0` is the keyword. Pass `--here` as `$1` to scope to the current project only.

## Step 1 — Query

```bash
duckdb :memory: -c "
SELECT
  regexp_extract(filename, 'projects/([^/]+)/', 1) AS project,
  strftime(timestamp::TIMESTAMPTZ, '%Y-%m-%d %H:%M') AS ts,
  message.role AS role,
  left(message.content::VARCHAR, 500) AS content
FROM read_ndjson('<SEARCH_PATH>', auto_detect=true, ignore_errors=true, filename=true)
WHERE message::VARCHAR ILIKE '%<KEYWORD>%'
  AND message.role IS NOT NULL
ORDER BY timestamp
LIMIT 40;
"
```

Search paths:

- All projects: `$HOME/.claude/projects/*/*.jsonl`
- Current only (`--here`): `$HOME/.claude/projects/$(echo "$PWD" | sed 's|[/_]|-|g')/*.jsonl`

Replace `<SEARCH_PATH>` and `<KEYWORD>` before running.

## Step 2 — Internalize

From the results, extract decisions, patterns, unresolved TODOs, and user corrections. Use this to inform your current response — do not repeat raw logs to the user.
