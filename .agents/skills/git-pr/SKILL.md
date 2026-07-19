---
name: git-pr
description: 作業ブランチ作成、ステージ、コミット、push、PR作成までのワークフロー。ローカル変更を develop または main 向けPRとして提出する時に使用する。
---

# Git PR ワークフロー

作業ブランチを作成し、変更をコミット・pushして、GitHub PRを作成するまでの標準手順。

## 前提条件

- 作業前に `git status` と `git diff` で変更内容を確認する
- コミット前に `typecheck` と `lint` を実行してコード品質を確認する
- pre-commit フックが失敗する場合は `--no-verify` でスキップ可（テストファイル未作成時など）

## 手順

### 1. ブランチ作成

```bash
git checkout -b <ブランチ名>
```

**命名規則:**

- `feat/<機能名>` — 新機能
- `fix/<修正内容>` — バグ修正
- `perf/<最適化内容>` — パフォーマンス改善
- `refactor/<対象>` — リファクタリング

### 2. ステージとコミット

```bash
# 変更ファイルをステージ
git add <ファイル1> <ファイル2> ...

# コミット（conventional commits 形式）
git commit -m "<type>(<scope>): <概要>

<詳細説明（任意）>"
```

**type の種別:**

- `feat` — 新機能
- `fix` — バグ修正
- `perf` — パフォーマンス改善
- `refactor` — リファクタリング
- `docs` — ドキュメント
- `chore` — その他

**フック失敗時:**

```bash
git commit --no-verify -m "..."
```

### 3. Push

```bash
git push -u origin <ブランチ名>
```

### 4. PR作成

```bash
gh pr create --base <対象ブランチ> --head <ブランチ名> --title "<タイトル>" --body "<本文>"
```

**注意:** `--body` 内のバックチック (`) はシェルで展開されるため、含めないかエスケープすること。

**PR本文のテンプレート:**

```markdown
## 概要

<変更の目的を1-2文で>

## 変更内容

- <変更1>
- <変更2>

## 技術詳細（任意）

<実装上の判断や補足>
```

### 5. 確認

```bash
gh pr view <PR番号> --json url,title,state
```

## 例

```bash
# ブランチ作成
git checkout -b feat/combobox-virtualization

# ステージ・コミット
git add packages/ui/src/combobox.tsx packages/ui/src/search-filters.tsx
git commit -m "perf(ui): add virtualization to Combobox components"

# Push
git push -u origin feat/combobox-virtualization

# PR作成
gh pr create --base develop --head feat/combobox-virtualization \
  --title "perf(ui): Comboboxの仮想化対応" \
  --body "## 概要\n候補数が多いComboboxのパフォーマンスを改善します。"
```
