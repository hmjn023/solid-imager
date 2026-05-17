---
name: issue-driven
description: GitHub Issue を「タスクの定義」と「思考の証跡」として活用する自律型開発ワークフロー。タスク開始時の issue コメント、実装過程の証跡、およびプルリクエスト作成前の進捗管理を issue 単位で行う際に使用してください。
---

# Issue-Driven Development Skill

GitHub Issueを「タスクの定義」と「思考の証跡」として使い、エージェントが自律的に開発を進めるワークフロー。

## ワークフロー

```
Issue分割 → issue着手 → Investigate → Plan → Implement → Review → Submit → Done
   ↓            ↓            ↓        ↓           ↓        ↓
 sub-issue  コメント投稿  コメント投稿 コメント投稿  ステータス移動  PR作成
```

| フェーズ | 行動 | 出力 |
|---------|------|------|
| **0. Issue分割** | 親issueを分析し、独立した作業単位で sub-issue を作成・リンク | Sub-issue 群 + 親issue更新 |
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

## Issue分割 と Sub-issue リンク

大きなタスクは **親issue（parent）** と **子issue（sub-issue）** に分割する。GitHub のネイティブ sub-issue 機能を使い、GraphQL API で親子関係を設定する。

### 手順

```bash
# 1. 親issueを作成
gh issue create \
  --title "<親タイトル>" \
  --body "<説明>\n\n## Sub-issues\n\n- ..."

# 2. 子issueを作成（増えるごとに随時）
gh issue create \
  --title "<子タイトル>" \
  --label "performance" \
  --body "## 概要\n\nParent: #<親番号>\n\n..."

# 3. 子issueの node ID を取得
gh api graphql -f query='
query {
  repository(owner: "hmjn023", name: "solid-imager") {
    issues(first: 20, orderBy: {field: CREATED_AT, direction: DESC}, states: [OPEN]) {
      nodes { number id }
    }
  }
}' --jq '.data.repository.issues.nodes[] | select(.number >= <親番号>) | "\(.number): \(.id)"'

# 4. GraphQL で sub-issue リンク（1回の mutation で複数リンク可能）
gh api graphql -f query='
mutation {
  <エイリアス1>: addSubIssue(input: {issueId: "<親のnodeID>", subIssueId: "<子のnodeID1>"}) {
    subIssue { number }
  }
  <エイリアス2>: addSubIssue(input: {issueId: "<親のnodeID>", subIssueId: "<子のnodeID2>"}) {
    subIssue { number }
  }
}'
```

または、全て作成した後にまとめてリンクする：

```bash
PARENT_ID=$(gh api graphql -f query='
  query { repository(owner:"hmjn023", name:"solid-imager") { issue(number:<親番号>) { id } } }
' --jq '.data.repository.issue.id')

CHILD_IDS=$(gh api graphql -f query='
  query { repository(owner:"hmjn023", name:"solid-imager") {
    issues(first:20, orderBy:{field:CREATED_AT,direction:DESC}, states:[OPEN]) { nodes { number id } }
  } }' --jq '.data.repository.issues.nodes[] | select(.number >= <開始番号> and .number <= <終了番号>) | .id')

# mutation 文字列を組み立て
MUTATION="mutation {"
for ID in $CHILD_IDS; do
  NAME="m$ID"
  MUTATION+=" $NAME: addSubIssue(input:{issueId:\"$PARENT_ID\",subIssueId:\"$ID\"}) { subIssue { number } }"
done
MUTATION+=" }"

gh api graphql -f query="$MUTATION"
```

**注意:**
- 子issueを作成したら**速やかに**親子リンクを設定すること（後でやろうとすると忘れる）
- sub-issue の body には `Parent: #<親番号>` を記載し、GitHub UI 上でも追跡可能にする
- sub-issue の完了は親issueの checklist で追跡する

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
