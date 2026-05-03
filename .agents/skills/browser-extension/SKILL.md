---
name: browser-extension
description: ブラウザ拡張機能 'apps/xtracter/' ディレクトリ内の開発、manifest.json の管理、および Web ページからのメタデータ抽出ロジック。拡張機能のバックグラウンドスクリプト、コンテンツスクリプト、またはポップアップUIを修正する際に使用してください。
---

# Browser Extension (xtracter) スキル

## Working Rules

- xtracter は独立したワークスペースです。変更を加える場合は `apps/xtracter/` ディレクトリ内で作業してください。
- メインプロジェクトの依存関係とは分離されています。
- メインプロジェクトのパッケージをインポートしないでください。

詳細は `apps/xtracter/README.md` を参照してください。

## Task Routing

| ユーザーの意図           | やること                         |
| ------------------------ | -------------------------------- |
| 拡張機能の開発           | `apps/xtracter/` ディレクトリ内で作業 |
| 拡張機能のビルド・テスト | `apps/xtracter/` 内のスクリプトを使用 |
