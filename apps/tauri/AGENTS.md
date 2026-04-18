# AGENTS.md - apps/tauri

## Role

`apps/tauri` は `apps/server` と無関係な独自機能を増やす場所ではない。デスクトップ固有事情がない限り、server 側の画面責務、操作モデル、API 形状、バックエンド挙動を踏襲する。

ただし `apps/tauri` は将来的に Android 上での動作も目指す。Tauri 側の実装は desktop 専用アプリとして閉じず、可能な限り Rust native と WebView で完結する構成を優先する。

## UI Rules

- 新規 route や大きな UI 変更では、先に `apps/server/src/routes` と対応 component を確認する。
- route 直書きの暫定 UI を増やしすぎない。継続利用する表示や操作は `apps/tauri/src/components` に切り出す。
- server 側に存在する概念名、props 名、state 名、並び順をできるだけ合わせる。
- mock データやローカル state は一時的な置き換えとし、API 接続時に差し替えやすい shape を保つ。
- `packages/ui` で表現できるものは独自スタイルを優先しない。

## Backend Rules

- `apps/tauri` を実装するときは、同一責務の機能が `apps/server` にないか先に確認し、あれば route、component、application、infrastructure を読んでから着手する。
- `apps/server` と `apps/tauri` の同一責務の機能を触るときは、片側だけ直して完了扱いにしない。もう片側でも同じ挙動を示すかを同一タスクで確認する。
- metadata 抽出、検索条件、保存処理、ジョブ処理、レスポンス shape のような backend 挙動は UI と同じ優先度で揃える。
- server 側に既存実装がある場合は参照実装として扱い、tauri 側の命名、入力、出力、処理順、失敗時の扱いをできるだけ揃える。
- 共通化できる処理は app ごとに二重実装しない。`packages/core` に寄せられる処理、server 側の既存ロジックを引き上げて使える処理を優先して使い回す。
- Tauri 固有実装が必要でも、入力、出力、命名、失敗時の扱いは server 側と揃える。
- Android 対応を見据え、Tauri 側では OS 依存の外部常駐サービスやローカルファイル直編集に寄りすぎず、Rust native と WebView の責務分離で完結できる構成を優先する。
- 設定保存は `config.json` ではなく Tauri のローカル DB に保存する。これは desktop と mobile で同じ永続化経路を使い、バックアップ、マイグレーション、配布形態の差分を吸収しやすくするためである。

## Before Diverging

次のどれかに当てはまるなら、独自実装前に理由をコメントまたはコミットメッセージで残すこと。

- server 側に同等 UI がない
- Tauri 固有 API に依存する
- 操作フローが desktop 固有で分岐する

それ以外は `.agents/skills/shared-ui-parity/SKILL.md` に従って server との機能同期を優先する。

## Integrated Jobs

`apps/tauri` では server 側の Job Queue をそのまま持ち込まず、`src-tauri` の local backend に統合された処理パイプラインとして扱う。

- ファイル同期の起点は `src-tauri/src/backend/sources.rs` の `sync_source()`。
- 新規追加・更新された画像に対する生成情報抽出と ComfyUI タグ抽出は `src-tauri/src/backend/media_processing.rs` から接続する。
- 抽出ロジック本体は `src-tauri/src/backend/metadata.rs` に置き、`generation_infos` と `media_tags` を更新する。
- UI 側は個別に重い処理を持たず、`media-added` `media-changed` `thumbnail-generated` `all-jobs-completed` などのイベントを購読して追従する。
- AI 一括タグ付けは別入口だが、進捗通知は同じイベントモデル (`job-progress` `job-completed` `job-failed`) に揃える。

新しいメディア処理を足すときは、route や component から直接実装せず、まずこの統合パイプラインへ接続する。metadata 抽出、サムネイル生成、AI タグ付けのようなバックグラウンド処理は `src-tauri` 側で完結させ、UI には結果と進捗イベントだけを渡すこと。
