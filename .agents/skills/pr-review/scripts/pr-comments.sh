#!/usr/bin/env bash
set -euo pipefail

# PRレビューコメント一覧を取得して整形表示
# Usage: bash pr-comments.sh [PR_NUMBER]

REPO="hmjn023/solid-imager"

if [[ $# -ge 1 ]]; then
  PR="$1"
else
  PR=$(gh pr view --repo "$REPO" --json number -q '.number' 2>/dev/null || true)
  if [[ -z "$PR" ]]; then
    echo "エラー: PR番号が指定されておらず、現在のPRも見つかりません" >&2
    exit 1
  fi
fi

echo "#${PR} のレビューコメント"
echo "================================"

COUNT=0
while IFS=$'\t' read -r ID NODE_ID PATH LINE AUTHOR BODY URL; do
  COUNT=$((COUNT + 1))

  TAG=""
  BODY_LOWER="${BODY,,}"
  if [[ "$BODY_LOWER" == *"critical"* ]]; then
    TAG=" [CRITICAL]"
  elif [[ "$BODY_LOWER" == *"medium"* ]]; then
    TAG=" [MEDIUM]"
  elif [[ "$BODY_LOWER" == *"low"* ]]; then
    TAG=" [LOW]"
  fi

  # 本文は最初の200文字まで
  BODY_SHORT="${BODY:0:200}"

  echo ""
  echo "コメント #${COUNT} (ID: ${ID})"
  echo "  ファイル: ${PATH}:${LINE}${TAG}"
  echo "  作成者: ${AUTHOR}"
  echo "  node_id: ${NODE_ID}"
  echo "  内容: ${BODY_SHORT}"
  echo "  → ${URL}"
done < <(gh api "repos/${REPO}/pulls/${PR}/comments" --paginate \
  --jq '.[] | [.id, .node_id, .path, (.line // "?"), .user.login, .body, .html_url] | @tsv')

echo ""
echo "================================"
echo "合計: ${COUNT}件"
