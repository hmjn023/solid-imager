---
name: read-memories
description: Claudeの過去セッションログから決定事項・未解決作業を検索する。過去の会話や作業の確認時に使用する。
---

# Read Memories

Search silently; use decisions, TODOs, and corrections without repeating raw logs. `$0` is the keyword; `$1=--here` scopes to the current project.

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
