# AGENTS.md - apps/tauri

## Role

`apps/tauri` は `apps/server` と無関係な独自 UI を増やす場所ではない。デスクトップ固有事情がない限り、server 側の画面責務と操作モデルを踏襲する。

## UI Rules

- 新規 route や大きな UI 変更では、先に `apps/server/src/routes` と対応 component を確認する。
- route 直書きの暫定 UI を増やしすぎない。継続利用する表示や操作は `apps/tauri/src/components` に切り出す。
- server 側に存在する概念名、props 名、state 名、並び順をできるだけ合わせる。
- mock データやローカル state は一時的な置き換えとし、API 接続時に差し替えやすい shape を保つ。
- `packages/ui` で表現できるものは独自スタイルを優先しない。

## Before Diverging

次のどれかに当てはまるなら、独自実装前に理由をコメントまたはコミットメッセージで残すこと。

- server 側に同等 UI がない
- Tauri 固有 API に依存する
- 操作フローが desktop 固有で分岐する

それ以外は `.agents/skills/shared-ui-parity/SKILL.md` に従って server との同期を優先する。
