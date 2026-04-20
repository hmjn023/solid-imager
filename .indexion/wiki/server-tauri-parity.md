# server / tauri 実装対応マップ

`apps/server` と `apps/tauri` で同一責務を別実装しているファイルの対応関係。共通化・見直しの際の参照用。

最終更新: 2026-04-21

## Routes（対応度: 90%）

ページルートはほぼ同一構成。server側のみAPIルート群が存在し、tauriはRust IPCで代替。

| server                                           | tauri                                            | 備考                         |
| ------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| `routes/__root.tsx`                              | `routes/__root.tsx`                              | 同一                         |
| `routes/$.tsx`                                   | `routes/$.tsx`                                   | 同一                         |
| `routes/index.tsx`                               | `routes/index.tsx`                               | 同一                         |
| `routes/about.tsx`                               | `routes/about.tsx`                               | 同一                         |
| `routes/config.tsx`                              | `routes/config.tsx`                              | 同一                         |
| `routes/manager.tsx`                             | `routes/manager.tsx`                             | 同一                         |
| `routes/search.tsx`                              | `routes/search.tsx`                              | 同一                         |
| `routes/sources/index.tsx`                       | `routes/sources/index.tsx`                       | 同一                         |
| `routes/sources/$mediaSourceId/index.tsx`        | `routes/sources/$mediaSourceId/index.tsx`        | 同一                         |
| `routes/sources/$mediaSourceId/$mediaId/index.tsx` | `routes/sources/$mediaSourceId/$mediaId/index.tsx` | 同一                     |
| `routes/api/rpc.$.ts`                            | ―（Rust IPC）                                    | oRPC vs Tauri IPC            |
| `routes/api/events.ts`                           | ―（Rust IPC）                                    | SSE vs Tauri event           |
| `routes/api/sources.$mediaSourceId.dump.ts`      | ―                                                | serverのみ                   |
| `routes/api/sources.$mediaSourceId.import.ts`    | ―                                                | serverのみ                   |
| `routes/api/sources.$mediaSourceId.$mediaId.ts`  | ―                                                | serverのみ（メディアファイル配信） |
| `routes/api/sources.$mediaSourceId.$mediaId.thumbnail.ts` | ―                                       | serverのみ（サムネイル配信）  |
| `routes/docs/swagger/index.tsx`                  | ―                                                | serverのみ（Swagger UI）     |

## Hooks（対応度: 100%、実装は異なる）

| ファイル名                          | server実装                                  | tauri実装                                  | 差異                             | 備考                              |
| ----------------------------------- | ------------------------------------------ | ----------------------------------------- | -------------------------------- | -------------------------------- |
| `use-media-source-events.ts`        | oRPC + SSE + AbortController               | `@tauri-apps/api/event` の `listen()`     | イベント取得方式が根本的に異なる |                                  |
| `use-current-search-persistence.ts` | `packages/ui` 経由で `@solid-imager/core` | `packages/ui` 経由で `@solid-imager/core` | 共通化済み                       | deepEqualはcore/utils/deep-equal |

## Components（対応度: ~90%）

### 対応���り

| ファイル名                                  | 差異のポイント                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `nav.tsx`                                   | Tauri版がナビゲーションバーのマスター。serverのものをTauriに合わせること（例外）                  |
| `source-card.tsx`                           | ほぼ同一                                                                                          |
| `source-delete-modal.tsx`                   | ほぼ同一                                                                                          |
| `source-form-modal.tsx`                     | ほぼ同一                                                                                          |
| `upload-media-modal.tsx`                    | ほぼ同一                                                                                          |
| `media/media-viewer.tsx`                    | server: HTTP `/api/sources/…` ↔ tauri: `fileSystem.readFile()` + `createObjectURL()` + onCleanup |
| `media/search-filters.tsx`                  | （packages/ui/shared）                                                                            |
| `media/preset-manager.tsx`                  | （packages/ui/shared）                                                                            |
| `media/pro-search-dialog.tsx`               | ほぼ同一                                                                                          |
| `media/ai-tagging-modal.tsx`                | ほぼ同一                                                                                          |
| `media/association-manager.tsx`             | （packages/ui/shared）                                                                            |
| `media/media-card-item.tsx`                 | ほぼ同一                                                                                          |
| `media/media-grid-item.tsx`                 | ほぼ同一                                                                                          |
| `media/media-sidebar.tsx`                   | ほぼ同一                                                                                          |
| `media/move-copy-media-dialog.tsx`          | ほぼ同一                                                                                          |
| `media/pro-search-builder.tsx`            | ほぼ同一                                                                                          |
| `media/search-control-panel.tsx`            | ほぼ同一                                                                                          |
| `media/sort-controls.tsx`                   | ほぼ同一                                                                                          |
| `media/thumbnail-image.tsx`                 | ほぼ同一                                                                                          |
| `imports/import-review-modal.tsx`           | server: `orpc.imports.*()` ↔ tauri: 専用ラッパー関数。デフォルトソース選択ロジックも微妙に異なる |
| `imports/pending-downloads-indicator.tsx`   | ほぼ同一                                                                                          |

### 片側のみ

| ファイル                      | 存在するapp |
| ----------------------------- | ----------- |
| `components/swagger-ui.tsx`   | serverのみ  |
| `components/simple-modal.tsx` | serverのみ  |
| `components/counter.tsx`      | serverのみ  |

## Repositories（対応度: 65%）

### 対応あり（8リポジトリ）

| リポジトリ                | 構造の差異                                                              | DBクライアント取得                                                       |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `media-repository.ts`     | server: クラス (`DrizzleMediaRepository`) ↔ tauri: オブジェクトリテラル | server: グローバル `db` ↔ tauri: DIコンテナ (`getTauriAppServices().db`) |
| `source-repository.ts`    | 同上                                                                    | 同上                                                                     |
| `tag-repository.ts`       | 同上                                                                    | 同上                                                                     |
| `character-repository.ts` | 同上                                                                    | 同上                                                                     |
| `ip-repository.ts`        | 同上                                                                    | 同上                                                                     |
| `author-repository.ts`    | 同上                                                                    | 同上                                                                     |
| `preset-repository.ts`    | 同上                                                                    | 同上                                                                     |
| `project-repository.ts`   | 同上                                                                    | 同上                                                                     |

### 片側のみ

| リポジトリ                  | 存在するapp                              |
| --------------------------- | ---------------------------------------- |
| `authors-repository.ts`     | serverのみ（`author-repository.ts`と重複の可能性あり、要確認） |
| `category-repository.ts`    | serverのみ                               |
| `collection-repository.ts`  | serverのみ                               |
| `job-repository.ts`         | serverのみ                               |
| `user-repository.ts`        | serverのみ                               |
| `media-repository-utils.ts` | serverのみ（検索ロジックユーティリティ） |
| `app-config-repository.ts`  | tauriのみ                                |
| `tauri-job-repository.ts`   | tauriのみ                                |

## Services（対応度: ~35%）

### 対応あり（Tauri: 11 services）

メソッド命名規則が統一されていない。

| サービス               | serverのメソッド名例                         | tauriのメソッド名例                                     |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `author-service.ts`    | `getAllAuthors`, `getAuthor`, `createAuthor` | `list`, `get`, `create`                                 |
| `tag-service.ts`       | `getAllTags`, `getTagById`, `createTag`      | `list`, `get`, `create`                                 |
| `character-service.ts` | `getAllCharacters`, `createCharacter`        | `list`, `create`                                        |
| `ip-service.ts`        | `getAllIps`, `createIp`                      | `list`, `create`                                        |
| `project-service.ts`   | `getAllProjects`, `getProjectsForMedia`      | `list`, `listForMedia`, `addToMedia`, `removeFromMedia` |
| `media-service.ts`     | ―                                            | ―                                                       |
| `preset-service.ts`    | ―                                            | ―                                                       |
| `source-service.ts`    | server: `media-source-service.ts`            | `TauriSourceService`（local-api/services/）          |
| `config-service.ts`  | server: `server-config-service.ts`         | `TauriConfigService`（local-api/services/）       |
| `ai-service.ts`      | ―                                            | `TauriAiService`（local-api/services/）（server委譲） |
| `source-backup-service.ts` | `backup-service.ts`（server）          | `TauriSourceBackupService`（local-api/services/）   |

### 片側のみ

| サービス                      | 存在するapp | 対応するtauri実装                   |
| ----------------------------- | ----------- | ----------------------------------- |
| `analytics-service.ts`        | serverのみ  | なし                                |
| `backup-service.ts`           | serverのみ  | `source-backup-service.ts`（tauri） |
| `bulk-operation-service.ts`   | serverのみ  | なし                                |
| `category-service.ts`         | serverのみ  | なし                                |
| `collection-service.ts`       | serverのみ  | なし                                |
| `data-migration-service.ts`   | serverのみ  | なし                                |
| `directory-service.ts`        | serverのみ  | なし                                |
| `directory-sync-service.ts`   | serverのみ  | なし                                |
| `event-service.ts`            | serverのみ  | なし（Rust IPC）                    |
| `filter-preset-service.ts`    | serverのみ  | なし                                |
| `integration-service.ts`      | serverのみ  | なし                                |
| `job-dispatch-service.ts`     | serverのみ  | なし                                |
| `maintenance-service.ts`      | serverのみ  | なし                                |
| `media-processing-job.ts`     | serverのみ  | なし（`process-media-job.ts` が近い）   |
| `media-processing-service.ts` | serverのみ  | なし                                |
| `media-source-service.ts`     | serverのみ  | `source-service.ts`（tauri）        |
| `search-service.ts`           | serverのみ  | なし                                |
| `server-config-service.ts`    | serverのみ  | `config-service.ts`（tauri）        |
| `tagging-service.ts`          | serverのみ  | なし                                |
| `thumbnail-service.ts`        | serverのみ  | なし                                |
| `user-service.ts`             | serverのみ  | なし                                |
| `workflow-service.ts`         | serverのみ  | なし                                |

## Jobs（対応度: ~30%）

| ファイル     | server                                         | tauri                                          |
| ------------ | ---------------------------------------------- | ---------------------------------------------- |
| ジョブキュー | `job-queue.ts`（stub / 未実装）                | `tauri-job-queue.ts`（実装済み、DB永続化あり） |
| ジョブワーカー | `job-worker.ts`                              | ―                                              |
| サムネイル   | `thumbnails.ts`                                | `process-media-job.ts`                        |
| ダウンロード | `download-jobs.ts`, `download-rate-limiter.ts` | なし                                           |
| ファイル監視 | `file-watcher-service.ts`（TS）                | `watcher.rs`（Rust）                           |
| タグ抽出     | `tag-extraction.ts`, `tagging-jobs.ts`         | なし                                           |
| SSE管理      | `sse-manager.ts`                               | なし（Rust IPC）                               |

## 共通化の優先度メモ

| 優先度 | 領域                             | 必要な作業                                            | 状態       |
| ------ | -------------------------------- | ----------------------------------------------------- | ---------- |
| 高     | Hooks                            | `deepEqual` をcoreに移すだけで即共通化可能            | ✅ 完了    |
| 高     | Components（検索・プリセット系） | APIコール層を外部注入にしてpresentational化           |            |
| 中     | Services                         | メソッド命名を `list/get/create/update/delete` に統一 |            |
| 中     | Repositories                     | DBクライアント取得をfactory化                         |            |
| 低     | Jobs                             | 実装方針が根本的に異なる（SSE vs Rust IPC）           |            |
| 対象者 | API Routes                       | 設計思想が異なるため共通化不要                        | 該当なし   |

## 前回からの主な変更点（2026-04-21更新）

- **Hooks**: `use-current-search-persistence.ts` が既に `packages/ui` 経由で `@solid-imager/core/utils/deep-equal` を使用。共通化済み
- **Services**: Tauri側に `apps/tauri/src/infrastructure/local-api/services/` が存在し、11サービス（author, tag, character, ip, project, media, preset, source, config, ai, source-backup）が実装されていることを確認（旧文档では不明確だった）
- **Jobs**: `process-media-job.ts`（tauri）を追加。media-processing-job.ts（server）と対になる
- **Components**: `search-filters`, `preset-manager`, `association-manager`, `pro-search-builder` は `packages/ui` 配下で共有されていることを確認
- 対応度の推定値を微調整（Services ~35%: 7/29 → 11/42 equivalent）