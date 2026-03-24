---
name: browser-extension
description: ブラウザ拡張機能 (xtracter) の開発における作業ディレクトリと依存関係のルール。拡張機能のコードを変更する際に参照してください。
---

# Browser Extension (xtracter) スキル

## Working Rules

- xtracter は独立したワークスペースです。変更を加える場合は `xtracter/` ディレクトリ内で作業してください。
- メインプロジェクトの依存関係とは分離されています。
- メインプロジェクトのパッケージをインポートしないでください。

詳細は `xtracter/README.md` を参照してください。

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| 拡張機能の開発 | `xtracter/` ディレクトリ内で作業 |
| 拡張機能のビルド・テスト | `xtracter/` 内のスクリプトを使用 |
