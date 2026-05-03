# 処理フロー

主要な処理経路をシーケンス図で示す。Mermaid で描画される。各図の直下に登場する実装ファイルへのリンクを置くので、図と併読すること。

---

## 1. メディア同期（ローカルソース）

起動時 / 手動トリガー時に、ファイルシステムとDBを突き合わせて差分を反映する。

```mermaid
sequenceDiagram
    participant Caller as Bootstrap / Manager UI
    participant DSS as DirectorySyncService
    participant FG as fast-glob
    participant MR as MediaRepository
    participant MPS as MediaProcessingService
    participant JR as JobRepository
    participant SSE as SseManager

    Caller->>DSS: syncMediaSource(sourceId)
    DSS->>FG: scan(rootPath)
    FG-->>DSS: fsFiles[]
    DSS->>MR: findBySource(sourceId)
    MR-->>DSS: dbFiles[]

    Note over DSS: diff = fsFiles vs dbFiles

    par Additions
        DSS->>MPS: registerAndProcess(sourceId, path)
        MPS->>MR: upsert(media)
        MPS->>JR: enqueue(thumbnail, metadata, auto_tagging)
        MPS->>SSE: sendEvent("media-added")
    and Deletions
        DSS->>MR: delete(mediaId)
        DSS->>SSE: sendEvent("media-deleted")
    end

    DSS-->>Caller: { added, deleted }
```

**実装**

- `apps/server/src/application/services/directory-sync-service.ts`
- `apps/server/src/application/services/media-processing-service.ts` — `registerAndProcess()`
- Tauri 側は `apps/tauri/src/infrastructure/local-api/services/source-service.ts` の `syncSource*` が同じ責務を担う（FS は Rust コマンド、DB は PGlite）。

---

## 2. 検索クエリ

`SearchState`（Zod）を入力に、Drizzle で動的 SQL を組み立てる。

```mermaid
sequenceDiagram
    participant UI as SearchState (Solid store)
    participant Route as TanStack Route loader
    participant RPC as orpc.media.search
    participant SS as SearchService
    participant MR as MediaRepository
    participant UT as media-search
    participant DB as PostgreSQL / PGlite

    UI->>Route: navigate(searchState)
    Route->>RPC: .query({ sourceId, params })
    RPC->>SS: searchMedia(params)
    SS->>MR: search(params)
    MR->>UT: buildSearchQuery(client, params)
    UT-->>MR: SQL<Drizzle>
    MR->>DB: SELECT ... WHERE ... LIMIT/OFFSET
    DB-->>MR: rows
    MR->>MR: mapToMedia(row)
    MR-->>SS: { items, total }
    SS-->>RPC: { items, total }
    RPC-->>Route: safe DTO
    Route-->>UI: hydrate grid
```

**実装**

- スキーマ: `packages/core/src/domain/search/schema.ts`
- モード変換: `packages/core/src/domain/search/logic.ts` (`calculateNextModeState`)
- SQL 構築: `packages/db/src/repositories/media-search.ts` (`buildSearchQuery`)
- プリセット自動保存: `apps/server/src/hooks/use-current-search-persistence.ts` （1000ms デバウンス）

---

## 3. インポート / リストア

`POST /api/sources/:id/import` にZIPをアップロード → バックグラウンドで復元 → UI でレビュー。

```mermaid
sequenceDiagram
    participant User
    participant API as /api/sources/:id/import
    participant BS as BackupService
    participant Z as unzipper
    participant Masters as Tag/Character/IP/Author repos
    participant MR as MediaRepository
    participant JR as JobRepository
    participant UI as ImportReviewModal

    User->>API: POST zip
    API->>BS: enqueueImport(zipStream)
    BS->>Z: openZip()
    Z-->>BS: entries
    Note over BS: validateRelativePath()<br/>(パストラバーサル防止)

    BS->>BS: parse dump.json<br/>mediaDumpItemSchema
    BS->>BS: _filterValidItems()
    BS->>Masters: upsert(tags, characters, ips, authors)<br/>source: "restored"
    BS->>MR: insert(media)
    BS->>MR: restore relations
    BS->>JR: enqueue(thumbnail) per media

    User->>UI: open review
    UI->>API: listPendingImports()
    User->>UI: confirm / cancel
    UI->>API: processPendingImports() / cancelPendingImports()
```

**実装**

- サーバー: `apps/server/src/application/services/backup-service.ts`
- Tauri: `apps/tauri/src/infrastructure/local-api/services/source-backup-service.ts` + `src-tauri/src/commands/backup.rs`
- ZIP レイアウト・dump schema は [backup-restore.md](./backup-restore.md) 参照

---

## 4. ジョブキュー

Postgres の `jobs` テーブルをキューとして、`JobWorker` が定期ポーリング。AIジョブと通常ジョブを独立プールで制御。

```mermaid
stateDiagram-v2
    [*] --> pending: enqueue()
    pending --> in_progress: worker.processJob()\n(markAsInProgress)
    in_progress --> completed: processor resolves\n(markAsCompleted)
    in_progress --> failed: processor throws\n(markAsFailed)
    failed --> [*]
    completed --> [*]
```

```mermaid
sequenceDiagram
    participant P as Producer<br/>(MediaProcessing, Backup, Maintenance)
    participant JR as JobRepository
    participant W as JobWorker (setTimeout loop)
    participant Proc as processor(job)
    participant SSE as SseManager

    P->>JR: insert({ type, payload, parentId? })
    loop every pollIntervalMs
        W->>JR: findPending(aiSlots, includeTypes=aiJobTypes)
        W->>JR: findPending(otherSlots, excludeTypes=aiJobTypes)
        JR-->>W: jobs[]
        par per job
            W->>JR: markAsInProgress(id)
            W->>Proc: run(job)
            alt ok
                Proc-->>W: result
                W->>JR: markAsCompleted(id, result)
            else error
                W->>JR: markAsFailed(id, error)
            end
            W->>SSE: sendEvent("global-jobs", "job-updated")
        end
    end
```

**実装**

- ワーカー: `apps/server/src/infrastructure/jobs/job-worker.ts`
- ディスパッチ: `apps/server/src/application/services/job-dispatch-service.ts`
- キュー API: `apps/server/src/infrastructure/jobs/job-queue.ts`
- AI専用プール: `aiJobTypes = ["auto_tagging"]`（他ジョブと並行動作）
- `concurrency` / `aiConcurrency` / `pollIntervalMs` は `AppConfig.jobs` で動的変更可能

---

## 5. SSE リアルタイム更新

`/api/events?channels=<sourceId>,global-jobs` にクライアントが接続し、サーバー側のイベントを受信する。

```mermaid
sequenceDiagram
    participant C as Client (Solid hook)
    participant R as /api/events
    participant SSE as SseManager
    participant FS as chokidar FSWatcher
    participant Emit as Internal producers<br/>(sync / jobs / copy / move)

    C->>R: GET EventSource<br/>?channels=srcA,global-jobs
    R->>SSE: addClient(srcA), addClient(global-jobs)
    SSE-->>R: clientIds
    R-->>C: stream (text/event-stream)

    Note over SSE,FS: ローカルソース毎に chokidar を起動
    FS->>SSE: add/change/unlink
    SSE->>SSE: sendEvent(srcA, "media-added", ...)

    Emit->>SSE: sendEvent(srcA|global-jobs, type, data)
    SSE->>R: controller.enqueue(SSE frame)
    R-->>C: event: media-added\ndata: {...}

    C->>R: abort (navigation / unmount)
    R->>SSE: removeClient(clientId)
    SSE->>FS: stop if no listeners
```

**実装**

- エンドポイント: `apps/server/src/routes/api/events.ts`
- マネージャ: `apps/server/src/infrastructure/jobs/sse-manager.ts`
- HMR 耐性のため clients / watchers / emitter は `globalThis` に保持
- イベント種別（抜粋）: `media-added`, `media-deleted`, `media-changed`, `media-copied`, `media-moved`, `thumbnail-generated`, `watcher-error`, `job-*`

---

## 6. Tauri ファイルウォッチャー

サーバーの chokidar 相当を Rust `notify` で実装。変更は Tauri イベントで JS 側に配信される。

```mermaid
sequenceDiagram
    participant FS as OS filesystem
    participant N as notify::RecommendedWatcher
    participant R as WatcherRegistry (Rust)
    participant App as AppHandle (Tauri)
    participant JS as source-service.ts (JS)
    participant DB as TauriMediaRepository<br/>(PGlite)
    participant UI as Solid query cache

    Note over JS,R: 起動時に source_watch_start(sourceId, path)
    JS->>R: invoke("source_watch_start")
    R->>N: watch(path, Recursive)

    FS->>N: Create/Modify/Remove event
    N->>R: event callback
    R->>R: should_forward_event(kind)
    R->>App: emit("source-watch-event",<br/>{ mediaSourceId, paths, timestamp })

    App->>JS: listen("source-watch-event")
    JS->>DB: upsert / delete media
    JS->>UI: invalidate queries
```

**実装**

- Rust: `apps/tauri/src-tauri/src/watcher.rs` (`source_watch_start` / `source_watch_stop` コマンド、`WatcherRegistry`)
- JS 受信: `apps/tauri/src/infrastructure/local-api/services/source-service.ts`
- フォワード対象イベント: `should_forward_event()` が Create/Modify/Remove の主要バリアントを通過させる
- リトライ: JS 側で起動失敗時に `WATCH_START_RETRY_DELAY_MS` で再試行

---

## 参考

- [architecture.md](./architecture.md) — 全体アーキテクチャ
- [orpc-flow.md](./orpc-flow.md) — oRPC リクエスト経路
- [db-schema.md](./db-schema.md) — テーブル定義と ER 図
- [search-design.md](./search-design.md) — 検索スキーマ詳細
- [backup-restore.md](./backup-restore.md) — ダンプ形式
