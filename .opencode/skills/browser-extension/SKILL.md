---
name: browser-extension
description: ブラウザ拡張機能 'xtracter/' ディレクトリ内の開発、manifest.json の管理、および Web ページからのメタデータ抽出ロジック。拡張機能のバックグラウンドスクリプト、コンテンツスクリプト、またはポップアップUIを修正する際に使用してください。
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
