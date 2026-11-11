# GitHub操作

PRの取得・選別・修正方針は [SKILL.md](../SKILL.md) を正本とする。以下は返信・解決が依頼されている場合のCLI例。owner/repo/PR番号は対象checkoutから取得した値を使い、レビュー本文をシェルコードへ埋め込まない。

## 返信

root commentの `databaseId` をRESTのcomment IDに使う。自分で作成した返信文をファイルに保存し、構造化payloadとして送る。

```bash
jq -n --rawfile body "$reply_file" '{body: $body}' > "$payload_file"
gh api --method POST \
  "repos/$owner/$repo/pulls/$pr_number/comments/$comment_id/replies" \
  --input "$payload_file"
```

まとめコメントを依頼された場合は、本文をファイルに保存して `gh pr comment "$pr_number" --body-file "$summary_file"` を使う。修正していない時に成功・修正済みの文面を投稿しない。

## スレッド解決

取得したスレッド自身の `id` を使う。root commentの `id` / `databaseId` とは異なる。

```bash
gh api graphql -f threadId="$thread_id" -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { id isResolved }
    }
  }'
```

未対応・保留の指摘を解決しない。実行後に `pr-comments.sh` で同じthread IDが `isResolved: true` になったことを確認する。

## ページネーション

取得ヘルパーはGitHub CLIの `gh api graphql --paginate` を使う。queryは `$endCursor: String` を受け、対象connectionから `pageInfo { hasNextPage endCursor }` を返す。API失敗時は部分的な一覧を出力せず失敗する。

仕様: [GitHub CLI — gh api](https://cli.github.com/manual/gh_api)
