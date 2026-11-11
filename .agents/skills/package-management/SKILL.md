---
name: package-management
description: Bun workspaceの依存追加・更新・削除。package.json・bun.lockを変更する時に使用する。
---

# Package Management

- 依存追加・更新・削除はBunで行い、package.jsonとbun.lockを一緒に更新する。依存を手書きしてからinstallする流れは避ける。
- 既存依存と追加先workspaceを確認する。rootは共通開発ツール、app固有の依存は各app、共有UIは `packages/ui`。`packages/core` への追加は必要性を確認する。
- package名・versionが不確かな場合は `bun add --cwd <workspace> --dry-run <package>@<version>` で解決を確認する。

```bash
bun add --cwd <workspace> <package>       # 開発依存は -d
bun update --cwd <workspace> <package>
bun remove --cwd <workspace> <package>
```

rootでの操作は `--cwd` を省略する。結果のpackage.json・bun.lockの差分と型チェックを確認する。overrides・trustedDependenciesに関係する依存はroot設定も確認し、major update・prereleaseの理由と影響範囲をPRに記載する。
