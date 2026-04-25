---
name: server-tauri-commonization
description: "既存の `apps/server` / `apps/tauri` 実装の乖離を整理し、server 側の実装・命名を正として `packages/core` / `packages/db` / `packages/application` / `packages/ui` へ切り出して共通化するときに使用してください。"
---

# server-tauri-commonization

既に存在する `apps/server` と `apps/tauri` の重複実装や乖離を、server 側を基準に shared package へ引き上げるための skill。

## Source of truth

- 共通化の現状マップは `.indexion/wiki/server-tauri-parity.md` を参照する
- 上位ルールは repo root の `AGENTS.md` と `apps/server/AGENTS.md`, `apps/tauri/AGENTS.md` を優先する
- ルールや対応関係を更新したら、skill だけで閉じず wiki も同じタスク内で更新する

## Core rule

- 共通化のための対応では、server 側の実装、責務分割、命名を正とする
- shared package に切り出すときも、public method 名、payload shape、失敗時の扱いは server 側を基準に揃える
- tauri 側は adapter / wrapper として追従させる
- 「shared 実装が存在する」だけでは不十分で、app 側から見て薄い adapter / wrapper に縮退して初めて共通化完了とみなす

## When to use

- 既に server / tauri の両方に存在する機能を `packages/core` / `packages/db` / `packages/application` / `packages/ui` へ寄せたいとき
- app ごとに重複している query 実行ロジック、repository、service、schema、UI を整理したいとき
- 片側で先に育った実装を shared package に引き上げ、もう片側を追従させたいとき
- tauri 側の命名や public API を、server 側に寄せながら内部実装だけ shared package へ置き換えたいとき

## Out of scope

- 単なる見た目合わせだけの作業
- API route や IPC transport のような transport 固有レイヤーの完全共通化
- `index` / `about` など shell page の差分
- Tauri の remote source (`sftp` / `s3`)
- Tauri standalone で AI を完結させる実装

## Workflow

1. 共通化したい責務を 1 行で定義する。
2. `.indexion/wiki/server-tauri-parity.md` を見て、既知の差分と例外を確認する。
3. server / tauri / shared package の 3 点を棚卸しする。
4. server 側の実装、命名、入出力、失敗時の扱いを読み、canonical な振る舞いを決める。
5. tauri 側の差分を列挙し、shared package へ寄せる部分と app 固有 adapter に残す部分を分ける。
6. 共通化先を決める。
7. shared package に切り出した後も、server 側の public contract を維持する。
8. tauri 側は必要なら wrapper で既存 wire API を維持しつつ、内部実装を shared package に置き換える。
9. PGlite を理由に query 実行ロジックや repository を app ごとに二重作成しない。
10. 共通化後に parity マップと例外を更新する。
11. shared package を使っていても app 側に大きな独自ロジックが残るなら、完了ではなく部分完了として扱う。

## Cut line

- `packages/core`: schema、型、判定ルール、ドメイン変換
- `packages/db`: repository factory、mapper、DB query、backup ロジック
- `packages/application`: application service、job payload、platform 非依存 utility
- `packages/ui`: presentational / shared UI
- app 側: executor 注入、filesystem、HTTP、IPC、Rust command などの platform 固有 I/O

## Review checklist

- server 側の命名と public contract を基準に共通化できているか
- tauri 側の差分が adapter / wrapper に閉じているか
- PGlite を理由に query 実行ロジックや repository を二重実装していないか
- `packages/core` / `packages/db` / `packages/application` / `packages/ui` のどこに置くべきか説明できるか
- parity マップと例外の説明を更新したか

## Strict completion gate

- shared package へ一部関数を移しただけでは完了にしない
- app 側ファイルが orchestration, validation, metadata 更新, event publish まで抱えているなら部分完了とみなす
- server / tauri の両方が同じ shared contract を使い、差分が transport / filesystem / executor / IPC に閉じている場合だけ完了とみなす
- public I/F や失敗時の扱いが app ごとに違うなら完了にしない
- wiki の対応度は import 数ではなく、shared package に寄った責務量で判断する

## File map

- Server routes: `apps/server/src/routes/`
- Server components: `apps/server/src/components/`
- Server backend: `apps/server/src/application/`, `apps/server/src/infrastructure/`
- Tauri routes: `apps/tauri/src/routes/`
- Tauri components: `apps/tauri/src/components/`
- Tauri local API: `apps/tauri/src/infrastructure/local-api/`
- Shared domain: `packages/core/`
- Shared repositories / backup: `packages/db/`
- Shared application: `packages/application/`
- Shared UI: `packages/ui/`
