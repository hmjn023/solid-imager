---
name: issue-driven
description: GitHub Issue をタスク定義と思考の証跡として使う開発ワークフロー。issue 起点の調査、計画コメント、実装メモ、PR前の進捗管理を行う時に使用する。
---

# Issue-Driven Development Skill

GitHub Issueを「タスクの定義」と「思考の証跡」として使い、エージェントが自律的に開発を進めるワークフロー。

## ワークフロー

```
issue着手 → Investigate → Plan → Implement → Review → Submit → Done
              ↓            ↓        ↓           ↓        ↓
           コメント投稿  コメント投稿 コメント投稿  ステータス移動  PR作成
```

| フェーズ | 行動 | 出力 |
|---------|------|------|
| **1. Investigate** | issue本文 + 既存コメント + コードベース読み取り | Investigation Note |
| **2. Plan** | 調査結果から実装計画を策定 | Plan Note |
| **3. Implement** | コード変更を実施 | Implementation Note |
| **4. Review** | lint/check/test 実行、セルフチェック | Review Checklist |
| **5. Submit** | PR作成 & Issue関連付け | Pull Request |

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

# 作業用ブランチを作成 (fix/issue-<NUMBER>-<TITLE_SLUG> 形式)
git checkout -b fix/issue-<NUMBER>-<TITLE_SLUG>
```

### 2. 調査フェーズ (Investigation Note)

調査が完了したらコメントとして投稿する。

### 3. 計画フェーズ (Plan Note)

実装方針を策定し、必要なら人間に確認する。**新規ディレクトリを作成する場合は `biome.json` の `includes` に追加することを忘れない。**

### 4. 実装フェーズ (Implementation Note)

コード変更を実施し、テスト結果を含めてコメントする。

### 5. レビューフェーズ (Review Checklist)

```bash
# セルフチェック (Vite Plus の check/typecheck を含む)
bun run check
bun run typecheck
bun run test

# チェックリスト投稿後にステータスを "In Review" へ
# projectId: PVT_kwHOBJLKfM4BSrJK, fieldId: PVTSSF_lAHOBJLKfM4BSrJKzhAI42Q, In Review ID: f250fa0e
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOBJLKfM4BSrJK"
    itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lAHOBJLKfM4BSrJKzhAI42Q"
    value: { singleSelectOptionId: "f250fa0e" }
  }) { projectV2Item { id } }
}'
```

### 6. 提出 (Submit) フェーズ

PRを作成し、GitHub の **Development** リンクを有効にする。

```bash
# PR作成 (本文に "fixes #<NUMBER>" または "closes #<NUMBER>" を含める)
# これにより正式な関連付け (Development link) が行われる
gh pr create --title "fix: <SUMMARY> (#<NUMBER>)" \
             --body "## 概要\n\nIssue #<NUMBER> を修正しました。\n\n## 変更点\n\n- ...\n\nfixes #<NUMBER>" \
             --base develop
```

## プロジェクト・メタデータ (solid-imager)

- **Owner**: `hmjn023`
- **Repo**: `solid-imager`
- **Project ID**: `PVT_kwHOBJLKfM4BSrJK`
- **Status Field ID**: `PVTSSF_lAHOBJLKfM4BSrJKzhAI42Q`

| ステータス | Option ID |
|-----------|-----------|
| **Todo** | `76512601` |
| **In Progress** | `abd28694` |
| **In Review** | `f250fa0e` |
| **Done** | `d32cf67d` |

## お役立ちコマンド

```bash
# アイテムID (PVTI_...) を取得
gh api graphql -f query='query { repository(owner:"hmjn023", name:"solid-imager") { issue(number:<NUMBER>) { projectItems(first:10) { nodes { id } } } } }'
```
