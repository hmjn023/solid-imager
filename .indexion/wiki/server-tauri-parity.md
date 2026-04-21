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

### 対応あり

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

## Services（対応度: ~55%）

`packages/application` を追加し、repository 依存だけで成立する application service と、platform 非依存の utility / job payload 定義を共通化した。
共通 service の public method は server 側で元々使っていた命名（例: `getAllAuthors`, `createAuthor`, `getCharactersForMedia`）へ揃える。server / tauri 側は既存の外部 API 名を維持しつつ、内部で `@solid-imager/application/services/*` の factory を利用する。

### 完全共通化済み（service本体）

| サービス               | 共通実装                                      | server側 wrapper                                  | tauri側 wrapper                                      |
| ---------------------- | --------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `author-service.ts`    | `packages/application/src/services/author-service.ts` | 旧 `getAllAuthors` 等を維持                    | `list/get/create/update/delete` を維持               |
| `tag-service.ts`       | `packages/application/src/services/tag-service.ts`    | 旧 `getAllTags` 等を維持                       | `list/get/create/update/delete` を維持               |
| `character-service.ts` | `packages/application/src/services/character-service.ts` | 旧 `CharacterServiceImpl` constructor と旧メソッドを維持 | Tauri repository adapter 経由で利用                  |
| `ip-service.ts`        | `packages/application/src/services/ip-service.ts`     | 旧 `getAllIps` 等を維持                        | `list/get/create/update/delete/listForMedia` を維持  |
| `project-service.ts`   | `packages/application/src/services/project-service.ts` | 旧 `getAllProjects` 等を維持                   | `list/get/create/update/delete/listForMedia` を維持  |
| `preset-service.ts`    | `packages/application/src/services/preset-service.ts` | `setPresetRepository` を維持                    | `TauriPresetService` を維持                          |
| `category-service.ts`  | `packages/application/src/services/category-service.ts` | serverのみ wrapper                              | ―                                                    |
| `collection-service.ts` | `packages/application/src/services/collection-service.ts` | serverのみ wrapper                             | ―                                                    |
| `user-service.ts`      | `packages/application/src/services/user-service.ts`   | serverのみ wrapper                              | ―                                                    |
| `search-service.ts`    | `packages/application/src/services/search-service.ts` | server proxy を維持                             | ―                                                    |

### 共通化済み（utility / port / payload）

| 領域                    | 共通実装                                      | 備考 |
| ----------------------- | --------------------------------------------- | ---- |
| `media-processing-job`  | `packages/application/src/services/media-processing-job.ts` | server / tauri の step 定義を共有 |
| `config-service`        | `packages/application/src/services/config-service.ts`, `utils/config-merge.ts` | Tauri は共通 service、server は config merge utility を使用 |
| `source-service`        | `packages/application/src/services/source-service.ts` | Safe DTO 変換と status/testConnection orchestration を共有。watcher/sync はTauri側に残す |
| TODO stub services      | `packages/application/src/services/stub-services.ts` | analytics / bulk-operation / data-migration / filter-preset / integration / workflow |

### 対応あり（Tauri: 11 services）

CRUD系の共通 service メソッド命名は server 側の旧名（`getAll*`, `get*Details`, `create*`, `update*`, `delete*` など）を正とし、Tauri 側は既存API互換 wrapper で `list/get/create/update/delete` を維持する。

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
| 高     | Components（検索・プリセット系） | APIコール層を外部注入にしてpresentational化           | ✅ 完了    |
| 中     | Services                         | `packages/application` に共通 service を切り出し、server/tauri wrapper から利用 | ✅ 一部完了 |
| 中     | Repositories                     | DBクライアント取得をfactory化                         |            |
| 低     | Jobs                             | 実装方針が根本的に異なる（SSE vs Rust IPC）           |            |
| 対象者 | API Routes                       | 設計思想が異なるため共通化不要                        | 該当なし   |

## 前回からの主な変更点（2026-04-21更新）

- **Hooks**: `use-current-search-persistence.ts` が既に `packages/ui` 経由で `@solid-imager/core/utils/deep-equal` を使用。共通化済み
- **Components**: `SearchControlPanel`, `SearchFilters`, `PresetManager`, `AssociationManager` が `packages/ui` に実装済み。server/tauri 両方で `@solid-imager/ui/search-control-panel` を import 使用
- **Services**: Tauri側に `apps/tauri/src/infrastructure/local-api/services/` が存在し、11サービス（author, tag, character, ip, project, media, preset, source, config, ai, source-backup）が実装されていることを確認（旧文档では不明確だった）
- **Jobs**: `process-media-job.ts`（tauri）を追加。media-processing-job.ts（server）と対になる
- 対応度の推定値を微調整（Services ~35%: 7/29 → 11/42 equivalent）
