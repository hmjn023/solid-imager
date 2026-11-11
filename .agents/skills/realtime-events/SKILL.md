---
name: realtime-events
description: source/job/importのイベント契約・配信・購読・再接続を変更する時に使用する。SSE・EventSource・EventEmitter・Tauri event busも対象。
---

# Realtime Events

## 配置

- schema: `packages/core/src/domain/sources/events.ts`
- contract: `packages/core/src/domain/contract/{sources,jobs,imports}.contract.ts`
- publisher: `apps/server/src/infrastructure/events/realtime-event-bus.ts`
- client再接続: `packages/ui/src/event-stream.ts`
- source transport: `packages/ui/src/hooks/use-media-source-events.ts`

## 変更手順

1. `sourceEventSchema` / `jobEventSchema` / `importEventSchema` のpayloadとunionを更新し、型を導出する。外部の `unknown` はschemaでparseする。
2. `RealtimeEventBus.publishSource/publishJob/publishImport` で配信する。DeferredActionsのsource eventは `publishSourceCommand` を使う。file watcher callbackが配信を担当し、watcher managerで重ねて送らない。
3. Core contractの出力を `@orpc/contract` の `asyncIteratorObject(<event schema>)` で定義する。routerはcontractを実装したasync generatorからyieldし、出力schemaを再定義しない。
4. clientは `subscribeToEventStream` / `createSourceEventTransport` を使い、callbackを追加する。platform差分はstream factory注入に限定し、再接続・AbortSignal cleanupを再実装しない。
5. 受信switchを `never` で網羅し、parse・publish/subscribe・callbackをテストする。型チェック・関連test・buildと、`orpc-api` のOpenAPI影響確認を行う。

## 禁止・監査

イベント名のstring型、配信APIの `unknown` payload型、別管理のイベント名配列・定数、routerだけのstreamを追加しない。機能コードから `EventEmitter.emit()` / `EventSource` / `@tauri-apps/api/event` を直接使わない。

```bash
rg -n 'EventSource|@tauri-apps/api/event|event(Type)?: string|sendEvent\(' apps packages
```
