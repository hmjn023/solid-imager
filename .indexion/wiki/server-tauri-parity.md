# server / tauri 実装対応マップ

`apps/server` と `apps/tauri` で同一責務を別実装しているファイルの対応関係。共通化・見直しの際の参照用。

最終更新: 2026-04-25（parity skill と保守ルールを同期）

## このページの使い方

- parity の実装判断は、このページと `.agents/skills/shared-ui-parity/SKILL.md` をセットで参照する
- ここでは「対応関係」と「意図的な差分」を管理する
- shell page 差分、Tauri の remote source、Tauri standalone AI は当面 parity 対象外
- 片側だけの追加が許容されるのは、platform 固有 I/O や transport 差分に閉じる場合だけ

## 関連ページ

- [Architecture](wiki://architecture)
- [apps/server](wiki://apps-server)
- [apps/tauri](wiki://apps-tauri)
- [Skills Catalog](wiki://skills)

## 更新トリガー

- `apps/server` / `apps/tauri` の route, component, hook, repository, service を片側だけ追加・削除したとき
- `packages/ui` / `packages/application` / `packages/db` へ共通化したとき
- parity 例外を追加した、または解消したとき
- server / tauri の命名、入出力、失敗時の扱い、処理順をどちらかだけ変更したとき

## 優先順位

1. ドメイン責務を揃える
2. 保存・取得・抽出などのバックエンド挙動を揃える
3. 画面遷移と情報構造を揃える
4. 主要操作を揃える
5. 見た目の差分を詰める

## Shared packages

| 領域 | 主な配置先 | 役割 |
| ---- | ---------- | ---- |
| schema / domain | `packages/core` | 型、schema、判定ルールの source of truth |
| repository | `packages/db` | DB factory、mapper、backup ロジックの共通化 |
| service / job payload | `packages/application` | platform 非依存の service、job helper、utility |
| UI | `packages/ui` | 再利用可能な presentational / shared UI |

## 実装ルール

- PGlite を理由に server / tauri で同等の query 実行ロジックや repository を二重実装してはならない
- 共通化のための対応では、server 側の実装、責務分割、命名を正として shared package に切り出す
- app 側の差分は executor 注入、transport、filesystem、IPC などの platform 固有 I/O に閉じ込める
- 例外を認める場合は、なぜ shared package では表現できないのかを明文化する

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
| `imports/import-review-modal.tsx`           | `packages/ui/import-review-modal.tsx` を共有。app 側は data/action adapter のみ                 |
| `imports/pending-downloads-indicator.tsx`   | `packages/ui/pending-downloads-indicator.tsx` を共有。app 側は event subscription adapter のみ |

### 片側のみ

| ファイル                      | 存在するapp |
| ----------------------------- | ----------- |
| `components/swagger-ui.tsx`   | serverのみ  |
| `components/simple-modal.tsx` | serverのみ  |
| `components/counter.tsx`      | serverのみ  |

## Repositories（対応度: ~85%）

`packages/db` を追加し、Drizzle ベースの repository 実装を factory (`createXRepository(getExecutor)`) として共通化した。server / tauri はそれぞれ executor provider（`db` グローバル or `getTauriAppServices().db`）を注入する薄い wrapper のみを保持する。`mapToX` も `packages/db` 側に集約。

### 完全共通化済み（factory本体は `@solid-imager/db/repositories/*`）

| リポジトリ                | 共通実装                                                 | server側 wrapper                                    | tauri側 wrapper                              |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| `author-repository.ts`    | `packages/db/src/repositories/author-repository.ts`      | `AuthorRepository`（object）。`authors-router` 側で降順ソート | `TauriAuthorRepository`（`orderByName` option付き、昇順） |
| `character-repository.ts` | `packages/db/src/repositories/character-repository.ts`   | 既存クラス / object を維持し factory に委譲         | 同上                                         |
| `ip-repository.ts`        | `packages/db/src/repositories/ip-repository.ts`          | 同上                                                 | 同上                                         |
| `preset-repository.ts`    | `packages/db/src/repositories/preset-repository.ts`      | 同上                                                 | 同上                                         |
| `project-repository.ts`   | `packages/db/src/repositories/project-repository.ts`     | 同上                                                 | 同上                                         |
| `source-repository.ts`    | `packages/db/src/repositories/source-repository.ts`      | `DrizzleSourceRepository`（factory 委譲クラス）     | `TauriSourceRepository`（`orderByName` option付き） |
| `media-repository.ts`     | `packages/db/src/repositories/media-repository.ts`       | `MediaRepository`（thin wrapper）                   | `TauriMediaRepository`（thin wrapper + bulk helpers） |
| `tag-repository.ts`       | `packages/db/src/repositories/tag-repository.ts`         | 同上                                                 | 同上                                         |
| `media-search` (util)     | `packages/db/src/repositories/media-search.ts`           | 旧 `media-repository-utils.ts` 相当の検索ロジック   | 同上                                         |

> 旧 `authors-repository.ts`（server側の重複実装）は削除済み。`author-repository.ts` に一本化。
>
> Factory の共通オプション: `orderByName`（`findAll` を `asc(name)` でソート）は author / character / ip / preset / project / source / tag で利用可。Tauri wrapper 側で有効化して旧実装の挙動を維持している。

### 共通化済み（対応あり）

| リポジトリ            | 備考                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `media-repository.ts` | `packages/db/src/repositories/media-repository.ts` に共通化。server / tauri は `createMediaRepository(getExecutor)` の薄い wrapper のみを保持 |

### 片側のみ

| リポジトリ                  | 存在するapp                              |
| --------------------------- | ---------------------------------------- |
| `category-repository.ts`    | serverのみ                               |
| `collection-repository.ts`  | serverのみ                               |
| `job-repository.ts`         | server / tauri（`packages/db` factory の薄い wrapper） |
| `user-repository.ts`        | serverのみ                               |
| `app-config-repository.ts`  | tauriのみ                                |
| `tauri-job-repository.ts`   | tauriのみ                                |

## Services（対応度: ~75%）

`packages/application` を追加し、repository 依存だけで成立する application service と、platform 非依存の utility / job payload 定義を共通化した。
共通 service の public method は server 側で元々使っていた命名（例: `getAllAuthors`, `createAuthor`, `getCharactersForMedia`, `searchMedia`, `uploadMedia`）へ揃える。server / tauri 側は外部 wire API を維持しつつ、内部で `@solid-imager/application/services/*` の factory を利用する。

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
| `media-service.ts`     | `packages/application/src/services/media-service.ts`  | 旧 `MediaServiceImpl` constructor と proxy を維持 | `TauriMediaService` も server 側メソッド名へ寄せる |

### 共通化済み（utility / port / payload）

| 領域                    | 共通実装                                      | 備考 |
| ----------------------- | --------------------------------------------- | ---- |
| `media-processing-job`  | `packages/application/src/services/media-processing-job.ts` | server / tauri の step 定義を共有 |
| `maintenance-service`   | `packages/application/src/services/maintenance-service.ts` | startup recovery の判定・job enqueue を共有。thumbnail path 解決と queue wake は app adapter に残す |
| `config-service`        | `packages/application/src/services/config-service.ts`, `utils/config-merge.ts` | Tauri は共通 service、server は config merge utility を使用 |
| `source-service`        | `packages/application/src/services/source-service.ts` | Safe DTO 変換と status/testConnection orchestration を共有。watcher/sync はTauri側に残す |
| `backup-service`        | `packages/db/src/backup.ts` | dump/restore の DB ロジックを共有。zip / fs / command client は app 固有のまま |
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
| `media-service.ts`     | `searchMedia`, `getMediaDetails`, `uploadMedia` | `searchMedia`, `getMediaDetails`, `uploadMedia`         |
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
| `media-processing-job.ts`     | serverのみ  | なし（`process-media-job.ts` が近い）   |
| `media-processing-service.ts` | serverのみ  | なし                                |
| `media-source-service.ts`     | serverのみ  | `source-service.ts`（tauri）        |
| `search-service.ts`           | serverのみ  | なし                                |
| `server-config-service.ts`    | serverのみ  | `config-service.ts`（tauri）        |
| `tagging-service.ts`          | serverのみ  | なし                                |
| `thumbnail-service.ts`        | serverのみ  | なし                                |
| `user-service.ts`             | serverのみ  | なし                                |
| `workflow-service.ts`         | serverのみ  | なし                                |

### backup の引数差分メモ

今回の共通化スコープでは、backup の公開引数はまだ揃えない。

- `createDump`
  - server: `createDump(mediaSourceId: string, mode?: "json" | "zip")`
  - tauri: `createDump(mediaSourceId: string, mode?: "json" | "zip")`
  - 戻り値は異なる。server は stream/Blob 系、tauri は `MediaDumpItem[] | BinaryFilePayload`
- `restoreSource`
  - server: `restoreSource(mediaSourceId: string, items: any[])`
  - tauri: `restoreSource(mediaSourceId: string, items: unknown[])`
  - 現状は配列を直接渡す前提。将来 `{ media: [] }` のような包み方をそろえるなら別タスクにする
- `importSourceZip`
  - server: `importSourceZip(mediaSourceId: string, zipFilePath: string)`
  - tauri: `importSourceZip(mediaSourceId: string, bytes: number[])`
  - zip の実入力は app ごとに異なるため、今回は wrapper 差分として残す

## Jobs（対応度: ~50%）

server も `DB_HOST=pglite` で PGlite に切替可能なため、PGlite は DB executor / repository を Tauri 固有実装として分ける理由にはしない。`jobs` table を source of truth とし、repository は `packages/db/src/repositories/job-repository.ts`、worker は `packages/application/src/services/job-worker.ts` を共通実装として使う。

| ファイル     | server                                         | tauri                                          |
| ------------ | ---------------------------------------------- | ---------------------------------------------- |
| job repository | `JobRepository`（`createJobRepository(() => db)`） | `TauriJobRepository`（`createJobRepository(() => getTauriAppServices().db)`） |
| ジョブキュー / worker | `JobWorker`（shared re-export）         | `tauri-job-queue.ts`（shared worker bootstrap adapter） |
| processMedia payload | `{ mediaId, sourcePath, steps?, type: "processMedia" }` | 同左 |
| サムネイル   | `thumbnails.ts`                                | `tauri-job-queue.ts` 内 processor              |
| ダウンロード | `download-jobs.ts`, `download-rate-limiter.ts` | なし                                           |
| ファイル監視 | `file-watcher-service.ts`（TS）                | `watcher.rs`（Rust）                           |
| タグ抽出     | `tag-extraction.ts`, `tagging-jobs.ts`         | なし                                           |
| SSE管理      | `sse-manager.ts`                               | なし（Rust IPC）                               |

## 共通化の優先度メモ

| 優先度 | 領域                             | 必要な作業                                            | 状態       |
| ------ | -------------------------------- | ----------------------------------------------------- | ---------- |
| 高     | Hooks                            | `deepEqual` をcoreに移すだけで即共通化可能            | ✅ 完了    |
| 高     | Components（検索・プリセット系） | APIコール層を外部注入にしてpresentational化           | ✅ 完了    |
| 中     | Services                         | `packages/application` に共通 service を切り出し、server/tauri wrapper から利用 | ✅ 主要CRUD・media・source/config/job/stub共通化済み |
| 中     | Repositories                     | `packages/db` に factory 集約、server/tauri は executor 注入の wrapper のみ | ✅ 完了 |
| 低     | Jobs                             | 実装方針が根本的に異なる（SSE vs Rust IPC）           |            |
| 対象者 | API Routes                       | 設計思想が異なるため共通化不要                        | 該当なし   |

## 保守メモ

- route / component の parity だけでなく、`packages/application` / `packages/db` への引き上げ余地も毎回確認する
- 新しい例外を追加する場合は、なぜ transport 差分や platform 固有事情で分離が必要なのかを明記する
- 片側だけ変更して完了にしない。未対応なら、もう片側への影響か未対応理由を必ず残す
- PGlite は共通化を諦める理由ではなく、shared repository / executor 注入で吸収する前提で扱う
- import inbox の pending queue は `localStorage` を廃止し、server / tauri とも `jobs` table の `import_request` を source of truth とする
- import request の `bulkAdd / listPending / process / cancel` は `packages/application/src/services/import-request-service.ts` を正とし、server / tauri は restore / execute / event publish の adapter だけを注入する

## 前回からの主な変更点（2026-04-25更新）

- **Jobs / Components**: import inbox を共通化。`packages/application/src/services/import-request-service.ts` に import request service を追加し、`packages/ui/src/import-review-modal.tsx` / `packages/ui/src/pending-downloads-indicator.tsx` を server / tauri で共有。Tauri の pending queue は `localStorage` から `jobs` table (`type=import_request`) へ移行し、server と同じ保存モデルへ統一
- **Services**: `media-service.ts` を `packages/application/src/services/media-service.ts` に共通化。server 側は既存 constructor/proxy 互換 wrapper、Tauri 側は `IMediaStorage` / `IImageProcessor` / transaction / metadata hook を注入する adapter へ変更。Tauri local procedure の wire 名は維持し、service method 名は server 側 (`searchMedia`, `getMediaDetails`, `uploadMedia` など) へ寄せた
- **Repositories（PR #267 レビュー対応）**: author factory に `orderByName` オプションを追加し Tauri wrapper で有効化（旧 `asc(name)` ソートを復元）。update に `isUniqueViolation → ResourceConflictError` を追加し他 repo と整合。tag `addTagsToMedia` で (name, type) のデデュープと、挿入後 lookup 失敗時の log+skip（flatMap）に変更
- **Repositories**: `packages/db` を追加し、author / character / ip / preset / project / source / tag の 7 repository と media-search ユーティリティを factory 形式で共通化。server / tauri は `createXRepository(getExecutor)` を呼ぶだけの薄い wrapper に縮退。重複していた server 側 `authors-repository.ts` は削除
- **Hooks**: `use-current-search-persistence.ts` が既に `packages/ui` 経由で `@solid-imager/core/utils/deep-equal` を使用。共通化済み
- **Components**: `SearchControlPanel`, `SearchFilters`, `PresetManager`, `AssociationManager` が `packages/ui` に実装済み。server/tauri 両方で `@solid-imager/ui/search-control-panel` を import 使用
- **Services**: `maintenance-service.ts` を `packages/application/src/services/maintenance-service.ts` に共通化。server は Node fs + `getSourceCacheDir()` adapter、Tauri は `thumbnailDir` 解決と `tauriJobQueue.registerQueuedSources()` adapter に縮退
- **Services**: `packages/application` を追加し、主要CRUD系（author, tag, character, ip, project, preset, category, collection, user）と media / search / source / config / TODO stub service を共通化。server / tauri wrapper は既存の外部 wire API を維持
- **Services対応度**: Tauri local-api / application の主要サービスのうち、10 services（author, tag, character, ip, project, preset, media, source, config, maintenance）が `packages/application` を利用。残りの ai / source-backup は platform 固有処理が多いため未共通化
- **Jobs**: media-processing job の step 定義・payload helper を `packages/application` に移動。server / tauri の実行基盤は引き続き別実装
- 対応度の推定値を更新（Repositories 65% → ~85%、Services ~55% → ~75%、Jobs ~30% → ~35%）
