---
name: realtime-events
description: source/job/import のリアルタイムイベント、oRPC Event Iterator、RealtimeEventBus、イベント名・payload schema、再接続処理を追加・変更する時に使用する。SSE、EventSource、EventEmitter、Tauri event bus、イベント購読・配信の変更でも必ず参照する。
---

# Realtime Events

リアルタイムイベントは Zod schema から送信・transport・受信型まで導出し、文字列キーと payload の drift を防ぐ。

## 唯一の契約

- イベント定義: `packages/core/src/domain/sources/events.ts`
- API contract:
  - source: `packages/core/src/domain/contract/sources.contract.ts`
  - job: `packages/core/src/domain/contract/jobs.contract.ts`
  - import: `packages/core/src/domain/contract/imports.contract.ts`
- server pub/sub: `apps/server/src/infrastructure/events/realtime-event-bus.ts`
- client 再接続: `packages/ui/src/event-stream.ts`
- source transport: `packages/ui/src/hooks/use-media-source-events.ts`

## 実装ルール

1. イベントを `sourceEventSchema`、`jobEventSchema`、`importEventSchema` のいずれかへ追加する。
2. payload は同じファイルの Zod schema とし、型を `z.infer` で導出する。
3. server からの配信は `RealtimeEventBus.publishSource`、`publishJob`、`publishImport` のみを使う。
4. oRPC stream は core contract と server router の双方で `eventIterator(<event schema>)` を出力 schema にする。
5. client は `subscribeToEventStream` または `createSourceEventTransport` を使い、再接続・AbortSignal cleanup を独自実装しない。
6. platform 差分は stream factory の注入だけに限定する。server と Tauri で購読ロジックを複製しない。
7. file watcher callback がドメイン処理とイベント配信を担当し、watcher manager は同じイベントを重ねて配信しない。
8. 全イベントを dispatch する `switch` は `never` assertion を置き、イベント追加時に handler 更新漏れを型エラーにする。

## 禁止

- イベント名を受ける `event: string` / `eventType: string`
- イベント payload を受ける `data: unknown` を application/server の配信 API に置くこと
- `EventEmitter.emit()`、ブラウザ `EventSource`、`@tauri-apps/api/event` を機能コードから直接使うこと
- event 名の配列、受信 `switch`、送信側定数を別々の正として管理すること
- core contract に存在しない router-only event stream

外部ライブラリ境界で `unknown` を受けた場合は、該当 event schema で parse してから内部へ渡す。

## 変更手順

1. core の payload schema と discriminated union を更新する。
2. `RealtimeEventBus` の typed publisher で送信する。
3. 必要な oRPC contract/router の `eventIterator` を更新する。
4. shared UI hook に callback を追加する。
5. schema parse、publish/subscribe、対象 callback のテストを追加する。
6. `bun run typecheck`、関連 test、`bun run build` を実行する。
7. contract/schema を変更した場合は `api-docs` skill に従って OpenAPI への影響を確認する。

## 監査

変更後に次を検索し、新しい独自経路がないことを確認する。

```bash
rg -n 'EventSource|@tauri-apps/api/event|event(Type)?: string|sendEvent\(' apps packages
```
