---
name: browser-extension
description: ブラウザ拡張機能 'apps/xtracter/' の開発、manifest.json、バックグラウンド/コンテンツスクリプト、ポップアップUI、Webページからのメタデータ抽出ロジックを修正する際に使用する。
---

# Browser Extension (xtracter) スキル

## Working Rules

- xtracter は `apps/xtracter/` 配下のワークスペースです。
- ブラウザ拡張は配布・権限・bundle 制約がアプリ本体と異なるため、共有パッケージを追加 import する前に bundle サイズと実行環境を確認する。
- manifest、permissions、content script の変更は実際の対象ページで動作確認する。

詳細は `apps/xtracter/README.md` を参照する。

## Task Routing

| ユーザーの意図           | やること                              |
| ------------------------ | ------------------------------------- |
| 拡張機能の開発           | `apps/xtracter/` ディレクトリ内で作業 |
| 拡張機能のビルド・テスト | `apps/xtracter/` 内のスクリプトを使用 |
