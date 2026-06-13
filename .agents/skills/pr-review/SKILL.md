---
name: pr-review
description: PRレビューコメントの取得・返信・解決。GitHub PRレビュー作業時に使用。`gh` CLI を使ったレビューコメントの一覧取得、個別対応、resolved マーク付けを行う。
---

# PR Review Workflow

PRレビューコメントの取得・返信・解決のワークフロー。

## コメント取得

`scripts/pr-comments.sh` でPRのレビューコメント一覧を取得する。

```bash
# 現在のPRのコメント取得
bash .opencode/skills/pr-review/scripts/pr-comments.sh

# PR番号を指定
bash .opencode/skills/pr-review/scripts/pr-comments.sh 425
```

出力例:
```
#425 のレビューコメント (8件)
================================
[L1127] apps/server/src/application/services/backup-service.ts (gemini-code-assist)
  タグ: critical
  archiver モジュールは ZipArchive という名前のコンストラクタを直接エクスポートしていません...
  → https://github.com/hmjn023/solid-imager/pull/425#discussion_rXXXXXXXX
```

## コメントへの返信

`gh` CLI で直接返信する。

```bash
gh api repos/{owner}/{repo}/pulls/{PR}/comments/{COMMENT_ID}/replies \
  --method POST -f body="対応しました。修正コミットを push しています。"
```

## コメントの解決

### レビュースレッドの解決（推奨）

PR のレビュースレッドを「解決済み」にする。GitHub UI のチェックマークが付く。

```bash
# 1. スレッド一覧を取得
gh api graphql -f query='
query {
  repository(owner: "hmjn023", name: "solid-imager") {
    pullRequest(number: <PR番号>) {
      reviewThreads(first: 10) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { id path body }
          }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | {threadId: .id, resolved: .isResolved, path: .comments.nodes[0].path}'

# 2. スレッドを解決
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "<THREAD_ID>"}) {
    thread { id isResolved }
  }
}'
```

### コメントの最小化（スパム等に使用）

`scripts/resolve-comment.sh` でコメントを minimized にする。スパム・オフトピック等に使用。

```bash
# node_id を指定して解決
bash .opencode/skills/pr-review/scripts/resolve-comment.sh <NODE_ID>

# pr-comments.sh の出力から node_id をコピーして使用
```

解決理由:
- `OUTDATED` - コードが更新されたため（デフォルト）
- `RESOLVED` - 問題が解決したため
- `ADDRESSED` - 対応済み
- `DUPLICATE` - 重複コメント
- `spam` / `abuse` / `off-topic` - その他の理由

## ワークフロー

1. `pr-comments.sh` でコメント一覧を取得
2. Critical/Medium の優先度に応じて対応
3. コード修正後、該当コメントに返信（対応内容の説明）
4. GraphQL `resolveReviewThread` でレビュースレッドを解決
5. 最終確認のため再度 `pr-comments.sh` で未解決コメントを確認

## メモ

- `gh api` の `--jq` でフィルタリング可能
- GraphQL の `minimizeComment` はコメントの `node_id` が必要
- `node_id` は `pr-comments.sh` の出力に含まれる
