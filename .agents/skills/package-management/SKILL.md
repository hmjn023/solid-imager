---
name: package-management
description: Node/Bun パッケージの追加・更新・削除を扱う。package.json、bun.lock、dependencies/devDependencies、workspace 依存、bun add/remove/update/install を変更する時に使用する。
---

# Package Management Skill

このリポジトリでは Bun の package manager を使います。依存追加は `package.json` を手で編集してから install するのではなく、`bun add` で package.json と bun.lock を同時に更新します。

## 原則

- 依存追加は `bun add` を使う。手編集だと存在しない package 名、誤った version range、lockfile との不整合が入りやすいため。
- 追加先 workspace を先に決める。root に入れる依存と app/package 固有の依存が混ざると bundle、runtime、CI の影響範囲が広がる。
- package 名と version は registry 上で解決できる形だけを使う。曖昧な名前や未確認のバージョンを package.json に書かない。
- `bun.lock` は `package.json` と一緒にコミットする。片方だけだと再現性が落ちる。

## 追加手順

1. 既存依存を確認する。

   ```bash
   bun pm ls
   sed -n '1,140p' <workspace>/package.json
   ```

2. 追加先を選ぶ。
   - root 開発ツール: root
   - server だけで使う: `@solid-imager/server`
   - Tauri だけで使う: `@solid-imager/tauri`
   - CLI だけで使う: `@solid-imager/cli`
   - 共有 UI: `@solid-imager/ui`
   - ドメイン/共有型: 追加前に本当に `packages/core` に必要か確認する

3. `bun add` で追加する。

   ```bash
   bun add <package>
   bun add -d <package>
   bun add --cwd <workspace> <package>
   bun add --cwd <workspace> -d <package>
   ```

   package 名や version に少しでも不確実性がある場合は、先に dry-run で registry 解決を確認する。

   ```bash
   bun add --dry-run <package>@<version>
   bun add --cwd <workspace> --dry-run <package>@<version>
   ```

4. 結果を確認する。
   ```bash
   git diff -- package.json '*/package.json' bun.lock
   bun run typecheck
   ```

## 避けるパターン

```bash
# package.json を直接編集してから install する流れは避ける
$EDITOR package.json
bun install
```

この流れは、存在しない package や壊れた version をレビューまで持ち込みやすい。依存追加・更新・削除は package manager の解決結果を先に作る。

## 更新・削除

```bash
bun update <package>
bun update --cwd <workspace> <package>
bun remove <package>
bun remove --cwd <workspace> <package>
```

major update や prerelease を入れる場合は、理由と影響範囲をPR本文に書く。既存 overrides や trustedDependencies に関係する package は、root `package.json` の該当欄も確認する。
