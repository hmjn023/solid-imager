---
name: git-worktree
description: git worktree を使った並列開発。複数の独立した変更を同時進行する際に、./.worktree/ 以下へ worktree を作成・管理する。PRを統合ブランチに向けるワークフローに使用。
---

# git worktree 並列開発

複数の独立した変更を並列実行する際は `./.worktree/` 以下に git worktree を作成する。

## 作成

```bash
# worktree 作成（統合ブランチから派生、同時に feature ブランチを作成）
git worktree add -b fix/issue-<番号>-<slug> ./.worktree/<番号>-<slug> <統合ブランチ>

# 例: 372-fix-performance-issue から #373 の作業用に
git worktree add -b fix/issue-373-quick-wins ./.worktree/373-quick-wins 372-fix-performance-issue
```

## worktree 内での作業

```bash
cd ./.worktree/<番号>-<slug>
bun install        # 各 worktree は独立した node_modules が必要
bun run check      # lint/format
bun run typecheck
bun run test
```

## PR 作成

```bash
# PR は統合ブランチに向ける（develop ではない）
gh pr create --base <統合ブランチ> \
  --title "..." \
  --body "...\n\nfixes #<番号>"
```

## 同期

統合ブランチに他PRがマージされた場合：

```bash
cd ./.worktree/<番号>-<slug>
git fetch origin
git merge origin/<統合ブランチ>
# 衝突があれば解決
git push origin fix/issue-<番号>-<slug>
```

## クリーンアップ

```bash
# worktree 削除
git worktree remove ./.worktree/<番号>-<slug>

# ブランチ削除（merge 済みなら -d, 未merge なら -D）
git branch -d fix/issue-<番号>-<slug>

# 一覧
git worktree list
```

## 注意

- `.worktree/` は `.gitignore` に追加済み（なければ追加すること）
- 各 worktree は独立した `node_modules/` を持つため、最初に `bun install` が必須
- 統合ブランチに変更があった場合は各 worktree で `git merge <統合ブランチ>` で同期
- 同一ファイルに触る並列作業は conflict のリスクあり。被る場合は直列実行に切り替える
