# AGENTS.md - apps/server

## Role

`apps/server` は UI の先行実装と参照実装になりやすい。route 構成、画面責務、操作導線を変えるときは `apps/tauri` 側への波及を前提に設計する。

## UI Rules

- route 配下で独自レイアウトや独自状態を追加するときは、同じ責務が `apps/tauri/src/routes` にも必要か確認する。
- 再利用できる表示部品やフォーム部品は route に閉じず、`apps/server/src/components` または `packages/ui` へ切り出す。
- `apps/tauri` が後追い移植しやすいよう、route が依存する component の粒度を明確に保つ。
- 画面仕様を変える変更では、`apps/tauri` 側の追従タスクや差分を同時に明記する。

## Porting Trigger

- `apps/server/src/routes`
- `apps/server/src/components`
- `packages/ui`

上記を変更して `apps/tauri` に同等画面がある場合、`.agents/skills/shared-ui-parity/SKILL.md` を参照する。
