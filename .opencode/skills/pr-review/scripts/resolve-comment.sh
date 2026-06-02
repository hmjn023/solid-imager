#!/usr/bin/env bash
set -euo pipefail

# GitHub PRレビューコメントをGraphQLで解決
# Usage: bash resolve-comment.sh <NODE_ID> [REASON]
#
# REASON: OUTDATED (default), RESOLVED, ADDRESSED, DUPLICATE

if [[ $# -lt 1 ]]; then
  echo "Usage: bash resolve-comment.sh <NODE_ID> [REASON]" >&2
  echo "  REASON: OUTDATED (default), RESOLVED, ADDRESSED, DUPLICATE" >&2
  exit 1
fi

NODE_ID="$1"
REASON="${2:-OUTDATED}"

VALID_REASONS="OUTDATED RESOLVED ADDRESSED DUPLICATE"
if [[ ! " $VALID_REASONS " =~ " $REASON " ]]; then
  echo "エラー: 無効な理由 '${REASON}'" >&2
  echo "有効な理由: $VALID_REASONS" >&2
  exit 1
fi

IS_MINIMIZED=$(gh api graphql -f query="
mutation {
  minimizeComment(input: {subjectId: \"${NODE_ID}\", classifier: ${REASON}}) {
    minimizedComment {
      isMinimized
    }
  }
}" -q '.data.minimizeComment.minimizedComment.isMinimized' 2>/dev/null)

if [[ "$IS_MINIMIZED" == "true" ]]; then
  echo "コメントを解決しました (${REASON})"
else
  echo "エラー: コメントの解決に失敗しました" >&2
  exit 1
fi
