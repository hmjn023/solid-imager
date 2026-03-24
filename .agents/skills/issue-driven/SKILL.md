---
name: issue-driven
description: GitHub Issue駆動の開発ワークフロー。調査・実装・レビューの証跡をissueコメントに残し、人間が読める形で進捗を管理する。issueをベースに開発作業を始めるときに参照してください。
---

# Issue-Driven Development Skill

GitHub Issueを「タスクの定義」と「思考の証跡」として使い、エージェントが自律的に開発を進めるワークフロー。

## ワークフロー

```
issue着手 → Investigate → Plan → Implement → Review → Done
              ↓            ↓        ↓           ↓
           コメント投稿  コメント投稿 コメント投稿  ステータス移動
```

| フェーズ | 行動 | 出力 |
|---------|------|------|
| **1. Investigate** | issue本文 + 既存コメント + コードベース読み取り | Investigation Note |
| **2. Plan** | 調査結果から実装計画を策定 | Plan Note |
| **3. Implement** | コード変更を実施 | Implementation Note |
| **4. Review** | lint/check/test 実行、セルフチェック | Review Checklist |

## 原則

- コメントは**日本語**で書く（人間が読むため）
- コード参照は `file_path:line_number` 形式
- 「なんとなく」ではなく「なぜそう判断したか」を記載する
- セッションをまたぐ場合は、まず**既存コメントを全て読んで**コンテクストを復元する
- 他issueの調査結果が必要な場合は、そちらのコメントも参照する

## 必須手順

### 1. issue着手時

```bash
# issue本文と既存コメントを全て読む
gh issue view <NUMBER>
gh issue view <NUMBER> --comments
```

### 2. 調査フェーズ

調査が完了したら **Investigation Note** をコメントとして投稿する。

```bash
gh issue comment <NUMBER> --body-file - <<'EOF'
## 🔍 Investigation Note

### 現状のコード
- `path/to/file.ts:L42` - 該当処理の説明
- 既存の実装パターン: ...

### 判断ポイント
- [選択肢A]: ...
- [選択肢B]: ...
- **採用理由:** ...

### 参考資料
- session.md: ...
- 他issue: ...
EOF
```

### 3. 計画フェーズ（人間への確認が必要な場合）

```bash
gh issue comment <NUMBER> --body-file - <<'EOF'
## 📋 Plan Note

### 実装方針
- 方針の説明

### 変更予定ファイル
| ファイル | 変更内容 |
|---------|---------|
| `path/a.ts` | 新規作成 |
| `path/b.ts` | 追記 |

### 確認事項
- [ ] 人間への質問事項

この方針で進めますか？
EOF
```

### 4. 実装フェーズ

コード変更を実施し、完了後に **Implementation Note** をコメントとして投稿する。

```bash
gh issue comment <NUMBER> --body-file - <<'EOF'
## 🔨 Implementation Note

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `path/a.ts` | 新規作成: 処理の説明 |
| `path/b.ts` | 追記: 変更の説明 |

### 実装判断
- ...の理由で...を選択

### テスト実行結果
```
（コマンドの出力を貼り付け）
```
EOF
```

### 5. レビューフェーズ

lint/check/test を実行し、結果を **Review Checklist** としてコメント投稿する。
全てPASSしたらステータスを In Review に移動する。

```bash
# セルフチェック
bun run lint
bun run check
bun run test

# チェックリスト投稿
gh issue comment <NUMBER> --body-file - <<'EOF'
## ✅ Review Checklist

- [x] `bun run lint` PASS
- [x] `bun run check` PASS
- [x] `bun run test` PASS
- [x] 型エラーなし
- [x] 不要なコメント追加なし
- [x] 既存パターンに準拠

### 残タスク / メモ
- 特になし
EOF

# ステータスを In Review に移動
# ステータスを In Review に移動
# （projectId, fieldId, itemId, optionId は `gh project` や `gh api` コマンドで確認）
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "<PROJECT_ID>"
    itemId: "<ITEM_ID>"
    fieldId: "<FIELD_ID>"
    value: { singleSelectOptionId: "<IN_REVIEW_OPTION_ID>" }
  }) { projectV2Item { id } }
}'
```

## ステータス管理

| ステータス | 移動タイミング | Option ID |
|-----------|--------------|-----------|
| **Todo** | issue未着手 | `76512601` |
| **In Progress** | 実装開始時 | `abd28694` |
| **In Review** | 実装完了・セルフチェック後 | `f250fa0e` |
| **Done** | 人間がマージ/承認後 | `d32cf67d` |

## コメント投稿コマンドリファレンス

```bash
# issue本文とコメントを読む
gh issue view <NUMBER>
gh issue view <NUMBER> --comments

# コメントを投稿する（HEREDOC推奨）
gh issue comment <NUMBER> --body-file - <<'EOF'
（本文）
EOF

# ステータスを変更する
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOBJLKfM4BSrJK"
    itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lAHOBJLKfM4BSrJKzhAI42Q"
    value: { singleSelectOptionId: "<OPTION_ID>" }
  }) { projectV2Item { id } }
}'

# サブイシューの進捗を確認する
gh api graphql -f query='
query {
  repository(owner: "hmjn023", name: "solid-imager") {
    issue(number: <NUMBER>) {
      subIssues(first: 20) {
        nodes { number title state }
      }
    }
  }
}'
```
