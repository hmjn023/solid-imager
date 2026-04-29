# server / tauri 実装対応マップ

`apps/server` と `apps/tauri` で同一責務を別実装しているファイルの対応関係。共通化・見直しの際の参照用。

最終更新: 2026-04-29（source-media grid の `SourceMediaGrid` 共通化完了）

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

| 領域                  | 主な配置先             | 役割                                           |
| --------------------- | ---------------------- | ---------------------------------------------- |
| schema / domain       | `packages/core`        | 型、schema、判定ルールの source of truth       |
| repository            | `packages/db`          | DB factory、mapper、backup ロジックの共通化    |
| service / job payload | `packages/application` | platform 非依存の service、job helper、utility |
| UI                    | `packages/ui`          | 再利用可能な presentational / shared UI        |

## 実装ルール

- PGlite を理由に server / tauri で同等の query 実行ロジックや repository を二重実装してはならない
- 共通化のための対応では、server 側の実装、責務分割、命名を正として shared package に切り出す
- app 側の差分は executor 注入、transport、filesystem、IPC などの platform 固有 I/O に閉じ込める
- 例外を認める場合は、なぜ shared package では表現できないのかを明文化する

## 厳格判定ルール

- 同名 route / component / service / repository が両 app にあるだけでは parity 達成とみなさない
- shared package を import していても、app 側に重い orchestration や分岐が残るなら「部分完了」とする
- 完了と呼べるのは、shared contract を両 app が使い、差分が platform 固有 I/O に閉じている場合だけ
- 例外は transport、filesystem、IPC、executor、OS integration に閉じるものに限定する
- `server 正` の基準から見て tauri 側 public I/F や失敗時の扱いが別物なら、共通化済みと数えない

## Routes（対応度: ~95%）

主要 route（search / sources / manager / config / source-media）が `packages/ui/src/screens/*` と `packages/ui/src/hooks/use-*-page.ts` へ共通化され、app 側 route は loader + query adapter + render prop 注入の thin wrapper に縮退。server側のみAPIルート群が存在し、tauriはRust IPCで代替。

厳格基準では、search / sources / manager / config / source-media の route 本体は共通化完了とみなせる。`source-media-page` の grid 部分も `SourceMediaGrid` (`packages/ui/src/source-media-grid.tsx`) へ共通化され、server / tauri は `renderItem` prop で app 固有の item 描画（`ThumbnailImage` / `<a>` vs `<Link>` など）を注入するだけに縮退。tauri は `enableVirtualization={true}` で仮想化を有効化。

| server                                                    | tauri                                              | 備考                               |
| --------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `routes/__root.tsx`                                       | `routes/__root.tsx`                                | 同一                               |
| `routes/$.tsx`                                            | `routes/$.tsx`                                     | 同一                               |
| `routes/index.tsx`                                        | `routes/index.tsx`                                 | 同一                               |
| `routes/about.tsx`                                        | `routes/about.tsx`                                 | 同一                               |
| `routes/config.tsx`                                       | `routes/config.tsx`                                | `ConfigScreen` 共有。差分は `onSubmitSuccess` callback（tauri: thumbnail cache reset）のみ |
| `routes/manager.tsx`                                      | `routes/manager.tsx`                               | `ManagerScreen` + `useManagerPage` 共有。差分は batch job event transport のみ |
| `routes/search.tsx`                                       | `routes/search.tsx`                                | `SearchScreen` + `useSearchPage` 共有。差分は `renderNavActions`（Portal vs inline）、refresh 戦略、`sourceRootPath` 注入、SSR guard |
| `routes/sources/index.tsx`                                | `routes/sources/index.tsx`                         | `SourcesScreen` + `useSourcesPage` 共有。差分は event transport（SSE vs Tauri event）と `href` 有無 |
| `routes/sources/$mediaSourceId/index.tsx`                 | `routes/sources/$mediaSourceId/index.tsx`          | `SourceMediaScreen` + `useSourceMediaPage` + `SourceMediaGrid` 共有。差分は `renderItem`（Thumbnail/Link の platform 差分）と `enableVirtualization` の有無 |
| `routes/sources/$mediaSourceId/$mediaId/index.tsx`        | `routes/sources/$mediaSourceId/$mediaId/index.tsx` | 同一                               |
| `routes/api/rpc.$.ts`                                     | ―（Rust IPC）                                      | oRPC vs Tauri IPC                  |
| `routes/api/events.ts`                                    | ―（Rust IPC）                                      | SSE vs Tauri event                 |
| `routes/api/sources.$mediaSourceId.dump.ts`               | ―                                                  | serverのみ                         |
| `routes/api/sources.$mediaSourceId.import.ts`             | ―                                                  | serverのみ                         |
| `routes/api/sources.$mediaSourceId.$mediaId.ts`           | ―                                                  | serverのみ（メディアファイル配信） |
| `routes/api/sources.$mediaSourceId.$mediaId.thumbnail.ts` | ―                                                  | serverのみ（サムネイル配信）       |
| `routes/docs/swagger/index.tsx`                           | ―                                                  | serverのみ（Swagger UI）           |

## Hooks（対応度: ~85%）

hook 本体は `packages/ui/src/hooks` へ寄り、app 側は transport adapter を注入する thin wrapper に縮退した。search / sources / source-media / manager それぞれのページ状態管理が shared hook 化され、route からの差分は query adapter と transport 実装に閉じる。差分は SSE と Tauri event bus の transport 実装に残るが、callback surface 自体はほぼ共通化済み。

| ファイル名                          | server実装                                        | tauri実装                                            | 差異                                             | 備考                                                            |
| ----------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `use-media-source-events.ts`        | `packages/ui` の shared hook + oRPC SSE transport | `packages/ui` の shared hook + Tauri event transport | transport 実装と event relevance filter が異なる | `onJobProgress` を含む callback I/F は shared hook 側へ統合済み |
| `use-batch-job-events.ts`           | `/api/events` SSE を購読し shared manager job handlers へ委譲 | Tauri `listen` と core event schema で購読し shared manager job handlers へ委譲 | transport のみ異なる | `manager.tsx` の batch tagging progress/completed/failed 更新は `packages/ui/src/hooks/use-manager-page.ts` 側へ移動 |
| `use-current-search-persistence.ts` | `packages/ui` 経由で `@solid-imager/core`         | `packages/ui` 経由で `@solid-imager/core`            | 共通化済み                                       | deepEqualはcore/utils/deep-equal                                |
| `use-search-page.ts`                | `packages/ui` の shared hook                      | `packages/ui` の shared hook                         | 共通化済み                                       | infinite query / dedup / scroll restore / observer を shared 化 |
| `use-sources-page.ts`               | `packages/ui` の shared hook                      | `packages/ui` の shared hook                         | 共通化済み                                       | source CRUD / sync / event の状態管理を shared 化               |
| `use-source-media-page.ts`          | `packages/ui` の shared hook                      | `packages/ui` の shared hook                         | 共通化済み                                       | source media の検索 / upload / dump / restore / move/copy を shared 化 |
| `use-manager-page.ts`               | `packages/ui` の shared hook                      | `packages/ui` の shared hook                         | 共通化済み                                       | manager の CRUD / batch tagging 状態管理を shared 化            |

## Components（対応度: ~92%）

leaf component の共有は進んだ。search / sources / manager / config / source-media の screen component 共通化により、route レベルの差分は大幅に縮小。`SourceMediaGrid` は `packages/ui/src/source-media-grid.tsx` に新設され、grid 表示・virtualization・context menu・empty state・result count を共有。app 側は `renderItem` prop で `MediaGridItem`（Thumbnail + Link の差分）を注入するだけに縮退。

厳格基準では、component 共有より route orchestration の共有度を重く見る。presentational component が shared でも、上位 route / render prop に重い差分が残る限り高評価しない。

### 対応あり

| ファイル名                                | 差異のポイント                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `nav.tsx`                                 | Tauri版がナビゲーションバーのマスター。serverのものをTauriに合わせること（例外）                                                  |
| `source-card.tsx`                         | ほぼ同一                                                                                                                          |
| `source-delete-modal.tsx`                 | ほぼ同一                                                                                                                          |
| `source-form-modal.tsx`                   | ほぼ同一                                                                                                                          |
| `upload-media-modal.tsx`                  | ほぼ同一                                                                                                                          |
| `media/media-viewer.tsx`                  | 対応はあるが実装差分が大きい。server は HTTP `/api/sources/…`、tauri は `fileSystem.readFile()` + `createObjectURL()` + onCleanup |
| `media/search-filters.tsx`                | （packages/ui/shared）                                                                                                            |
| `media/preset-manager.tsx`                | （packages/ui/shared）                                                                                                            |
| `media/pro-search-dialog.tsx`             | ほぼ同一                                                                                                                          |
| `media/ai-tagging-modal.tsx`              | ほぼ同一                                                                                                                          |
| `media/association-manager.tsx`           | （packages/ui/shared）                                                                                                            |
| `media/media-card-item.tsx`               | ほぼ同一                                                                                                                          |
| `media/media-grid-item.tsx`               | ほぼ同一                                                                                                                          |
| `media/media-sidebar.tsx`                 | ほぼ同一                                                                                                                          |
| `media/move-copy-media-dialog.tsx`        | ほぼ同一                                                                                                                          |
| `media/pro-search-builder.tsx`            | ほぼ同一                                                                                                                          |
| `media/search-control-panel.tsx`          | ほぼ同一                                                                                                                          |
| `media/sort-controls.tsx`                 | ほぼ同一                                                                                                                          |
| `media/thumbnail-image.tsx`               | ほぼ同一                                                                                                                          |
| `imports/import-review-modal.tsx`         | `packages/ui/import-review-modal.tsx` を共有。app 側は data/action adapter のみ                                                   |
| `imports/pending-downloads-indicator.tsx` | `packages/ui/pending-downloads-indicator.tsx` を共有。app 側は event subscription adapter のみ                                    |
| `media/source-media-grid.tsx`             | `packages/ui/src/source-media-grid.tsx` を新設。server / tauri で共有。差分は `renderItem` prop のみ                         |
| `media/media-list-actions.tsx`            | server / tauri とも `SourceMediaScreen` の `renderActions` prop として存在。app 側で組み立て（nav action の配置差分）             |

### 片側のみ

| ファイル                      | 存在するapp |
| ----------------------------- | ----------- |
| `components/swagger-ui.tsx`   | serverのみ  |
| `components/simple-modal.tsx` | serverのみ  |
| `components/counter.tsx`      | serverのみ  |

## Repositories（対応度: ~92%）

`packages/db` に repository factory はほぼ集約され、author / category / character / collection / ip / media / preset / project / source / tag / user / job は server / tauri とも shared repository contract を使う構成へ前進した。app 固有 repository は app-config や一部 job/bootstrap 周辺に残るが、CRUD 系 repository parity の穴はほぼ解消。

厳格基準では、factory 化された数ではなく、両 app が本当に同じ shared repository contract を使っているかで評価する。category / collection / user の Tauri wrapper 追加で主要 CRUD repository の非対称は解消され、残る差分は app-config など platform 固有 repository が中心。

### 共通 factory あり（factory本体は `@solid-imager/db/repositories/*`）

| リポジトリ                 | 共通実装                                                | server側 wrapper                                              | tauri側 wrapper                                           |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `author-repository.ts`     | `packages/db/src/repositories/author-repository.ts`     | `AuthorRepository`（object）。`authors-router` 側で降順ソート | `TauriAuthorRepository`（`orderByName` option付き、昇順） |
| `category-repository.ts`   | `packages/db/src/repositories/category-repository.ts`   | `DrizzleCategoryRepository`（factory 委譲クラス）             | `TauriCategoryRepository`（thin wrapper）                 |
| `character-repository.ts`  | `packages/db/src/repositories/character-repository.ts`  | 既存クラス / object を維持し factory に委譲                   | 同上                                                      |
| `collection-repository.ts` | `packages/db/src/repositories/collection-repository.ts` | `CollectionRepository`（thin wrapper）                        | `TauriCollectionRepository`（thin wrapper）               |
| `ip-repository.ts`         | `packages/db/src/repositories/ip-repository.ts`         | 同上                                                          | 同上                                                      |
| `preset-repository.ts`     | `packages/db/src/repositories/preset-repository.ts`     | 同上                                                          | 同上                                                      |
| `project-repository.ts`    | `packages/db/src/repositories/project-repository.ts`    | 同上                                                          | 同上                                                      |
| `source-repository.ts`     | `packages/db/src/repositories/source-repository.ts`     | `DrizzleSourceRepository`（factory 委譲クラス）               | `TauriSourceRepository`（`orderByName` option付き）       |
| `media-repository.ts`      | `packages/db/src/repositories/media-repository.ts`      | `MediaRepository`（thin wrapper）                             | `TauriMediaRepository`（thin wrapper + bulk helpers）     |
| `tag-repository.ts`        | `packages/db/src/repositories/tag-repository.ts`        | 同上                                                          | 同上                                                      |
| `user-repository.ts`       | `packages/db/src/repositories/user-repository.ts`       | `UserRepository`（thin wrapper）                              | `TauriUserRepository`（thin wrapper）                     |
| `media-search` (util)      | `packages/db/src/repositories/media-search.ts`          | 旧 `media-repository-utils.ts` 相当の検索ロジック             | 同上                                                      |

> 旧 `authors-repository.ts`（server側の重複実装）は削除済み。`author-repository.ts` に一本化。
>
> Factory の共通オプション: `orderByName`（`findAll` を `asc(name)` でソート）は author / character / ip / preset / project / source / tag で利用可。Tauri wrapper 側で有効化して旧実装の挙動を維持している。

### 共通化済み（対応あり）

| リポジトリ            | 備考                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `media-repository.ts` | `packages/db/src/repositories/media-repository.ts` に共通化。server / tauri は `createMediaRepository(getExecutor)` の薄い wrapper のみを保持 |

### app 固有 or 差分が残るもの

| リポジトリ                 | 存在するapp                                            |
| -------------------------- | ------------------------------------------------------ |
| `job-repository.ts`        | server / tauri（`packages/db` factory の薄い wrapper） |
| `app-config-repository.ts` | tauriのみ                                              |
| `tauri-job-repository.ts`  | tauriのみ                                              |

## Services（対応度: ~72%）

`packages/application` の追加自体は前進し、CRUD 系はほぼ shared 化完了。source / media / backup など主機能も shared contract を使う形へ前進したが、tauri 側 `media-service.ts` と `source-backup-service.ts` はまだ app 固有ロジックを多く抱えている。

共通 service の public method は server 側で元々使っていた命名（例: `getAllAuthors`, `createAuthor`, `getCharactersForMedia`, `searchMedia`, `uploadMedia`）へ揃える方針だが、実装実態はサービスごとにばらつきがある。

厳格基準では、`apps/tauri/src/infrastructure/local-api/services/source-service.ts` は shared `createSourceService` を使う段階まで前進。watcher / sync / filesystem / event / queue orchestration は Tauri adapter 内に残るが、list/get/testConnection/getStatus は shared 化。`media-service.ts` は shared `packages/application/src/services/media-service.ts` を使う形へ前進し、`contextMetadataUpdater` / `afterMediaRegistered` / `extractAndUpdateMetadata` は shared 化済み。主要サービス共通化は前進したが、upload collision resolution algorithm など未 shared 部分が残る。

### service 本体を shared 利用しているもの

| サービス                | 共通実装                                                  | server側 wrapper                                         | tauri側 wrapper                                                                                                                 |
| ----------------------- | --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `author-service.ts`     | `packages/application/src/services/author-service.ts`     | 旧 `getAllAuthors` 等を維持                              | `list/get/create/update/delete` を維持                                                                                          |
| `tag-service.ts`        | `packages/application/src/services/tag-service.ts`        | 旧 `getAllTags` 等を維持                                 | `list/get/create/update/delete` を維持                                                                                          |
| `character-service.ts`  | `packages/application/src/services/character-service.ts`  | 旧 `CharacterServiceImpl` constructor と旧メソッドを維持 | Tauri repository adapter 経由で利用                                                                                             |
| `ip-service.ts`         | `packages/application/src/services/ip-service.ts`         | 旧 `getAllIps` 等を維持                                  | `list/get/create/update/delete/listForMedia` を維持                                                                             |
| `project-service.ts`    | `packages/application/src/services/project-service.ts`    | 旧 `getAllProjects` 等を維持                             | `list/get/create/update/delete/listForMedia` を維持                                                                             |
| `preset-service.ts`     | `packages/application/src/services/preset-service.ts`     | `setPresetRepository` を維持                             | `TauriPresetService` を維持                                                                                                     |
| `category-service.ts`   | `packages/application/src/services/category-service.ts`   | `DrizzleCategoryService`（factory 委譲クラス）           | `TauriCategoryService`（thin wrapper）。`list/get/create/update/delete` を維持                                                 |
| `collection-service.ts` | `packages/application/src/services/collection-service.ts` | `CollectionService`（thin wrapper）                      | `TauriCollectionService`（thin wrapper）。`list/get/create/update/delete/addToMedia/removeFromMedia` を維持                   |
| `user-service.ts`       | `packages/application/src/services/user-service.ts`       | `UserService`（thin wrapper）                            | `TauriUserService`（thin wrapper）。`list/get/create/update/delete` を維持                                                     |
| `search-service.ts`     | `packages/application/src/services/search-service.ts`     | server proxy を維持                                      | ―                                                                                                                               |
| `media-service.ts`      | `packages/application/src/services/media-service.ts`      | 旧 `MediaServiceImpl` constructor と proxy を維持        | `TauriMediaService` は thin adapter に縮退。`contextMetadataUpdater` / `afterMediaRegistered` / `extractAndUpdateMetadata` を shared 化 |

### 共通化済み（utility / port / payload）

| 領域                   | 共通実装                                                                       | 備考                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `media-processing-job` | `packages/application/src/services/media-processing-job.ts`                    | server / tauri の step 定義を共有                                                                                                                                              |
| `maintenance-service`  | `packages/application/src/services/maintenance-service.ts`                     | startup recovery の判定・job enqueue を共有。thumbnail path 解決と queue wake は app adapter に残す                                                                            |
| `config-service`       | `packages/application/src/services/config-service.ts`, `utils/config-merge.ts` | Tauri は共通 service、server は config merge utility を使用                                                                                                                    |
| `source-service`       | `packages/application/src/services/source-service.ts`                          | server は shared service を利用。tauri も `createSourceService` を使って list/get/testConnection/getStatus を共有し、watcher / sync / fs / event / queue だけを adapter に残す |
| `backup-service`       | `packages/db/src/backup.ts`                                                    | dump/restore の DB ロジックを共有。zip / fs / command client は app 固有のまま                                                                                                 |
| `backup-restore-complete` | `packages/application/src/services/backup-restore-complete.ts`              | restore 後の thumbnail job enqueue を shared 化。server / tauri とも利用                                                                                                      |
| TODO stub services     | `packages/application/src/services/stub-services.ts`                           | analytics / bulk-operation / data-migration / filter-preset / integration / workflow                                                                                           |

### 対応あり（名称・責務が近いもの）

CRUD系の共通 service メソッド命名は server 側の旧名（`getAll*`, `get*Details`, `create*`, `update*`, `delete*` など）を正とし、Tauri 側は既存API互換 wrapper で `list/get/create/update/delete` を維持する。

| サービス                   | serverのメソッド名例                                            | tauriのメソッド名例                                      |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `author-service.ts`        | `getAllAuthors`, `getAuthor`, `createAuthor`                    | `list`, `get`, `create`                                  |
| `category-service.ts`      | `getAllCategories`, `getCategoryDetails`, `createCategory`      | `list`, `get`, `create`                                  |
| `tag-service.ts`           | `getAllTags`, `getTagById`, `createTag`                         | `list`, `get`, `create`                                  |
| `character-service.ts`     | `getAllCharacters`, `createCharacter`                           | `list`, `create`                                         |
| `collection-service.ts`    | `getAllCollections`, `getCollectionDetails`, `createCollection` | `list`, `get`, `create`, `addToMedia`, `removeFromMedia` |
| `ip-service.ts`            | `getAllIps`, `createIp`                                         | `list`, `create`                                         |
| `project-service.ts`       | `getAllProjects`, `getProjectsForMedia`                         | `list`, `listForMedia`, `addToMedia`, `removeFromMedia`  |
| `media-service.ts`         | `searchMedia`, `getMediaDetails`, `uploadMedia`                 | `searchMedia`, `getMediaDetails`, `uploadMedia`          |
| `preset-service.ts`        | ―                                                               | ―                                                        |
| `source-service.ts`        | server: `media-source-service.ts`                               | `TauriSourceService`（local-api/services/）              |
| `config-service.ts`        | server: `server-config-service.ts`                              | `TauriConfigService`（local-api/services/）              |
| `ai-service.ts`            | ―                                                               | `TauriAiService`（local-api/services/）（server委譲）    |
| `source-backup-service.ts` | `backup-service.ts`（server）                                   | `TauriSourceBackupService`（local-api/services/）        |
| `user-service.ts`          | `getAllUsers`, `getUserDetails`, `createUser`                   | `list`, `get`, `create`                                  |

### 未対応・片側のみ

| サービス                      | 存在するapp | 対応するtauri実装                                          |
| ----------------------------- | ----------- | ---------------------------------------------------------- |
| `analytics-service.ts`        | serverのみ  | なし                                                       |
| `backup-service.ts`           | serverのみ  | `source-backup-service.ts`（tauri）                        |
| `bulk-operation-service.ts`   | serverのみ  | なし                                                       |
| `category-service.ts`         | serverのみ  | `TauriCategoryService`（local-api/services/）              |
| `collection-service.ts`       | serverのみ  | `TauriCollectionService`（local-api/services/）            |
| `data-migration-service.ts`   | serverのみ  | なし                                                       |
| `directory-service.ts`        | serverのみ  | なし                                                       |
| `directory-sync-service.ts`   | serverのみ  | なし                                                       |
| `event-service.ts`            | serverのみ  | なし（Rust IPC）                                           |
| `filter-preset-service.ts`    | serverのみ  | なし                                                       |
| `integration-service.ts`      | serverのみ  | なし                                                       |
| `job-dispatch-service.ts`     | serverのみ  | なし                                                       |
| `media-processing-job.ts`     | serverのみ  | なし（`process-media-job.ts` が近い）                      |
| `media-processing-service.ts` | serverのみ  | なし                                                       |
| `media-source-service.ts`     | serverのみ  | `source-service.ts`（tauri）                               |
| `search-service.ts`           | serverのみ  | tauri は API client 経由で利用し、service wrapper は未整備 |
| `server-config-service.ts`    | serverのみ  | `config-service.ts`（tauri）                               |
| `tagging-service.ts`          | serverのみ  | なし                                                       |
| `thumbnail-service.ts`        | serverのみ  | なし                                                       |
| `user-service.ts`             | serverのみ  | `TauriUserService`（local-api/services/）                  |
| `workflow-service.ts`         | serverのみ  | なし                                                       |

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

## Jobs（対応度: ~85%）

server も `DB_HOST=pglite` で PGlite に切替可能なため、PGlite は DB executor / repository を Tauri 固有実装として分ける理由にはしない。`jobs` table を source of truth とし、repository は `packages/db/src/repositories/job-repository.ts`、worker は `packages/application/src/services/job-worker.ts` を共通実装として使う。2026-04-26 の更新で、job type dispatch / deferred actions / background startup coordinator に加えて、`downloadImage` / `auto_tagging` / `bulk_tagging_dispatch` の runner、job event publish contract、watcher の change/delete reconciliation helper、`processMedia` の payload helper / runner / batch runner / source progress tracker も `packages/application` に寄せた。Tauri 側の `tauri-job-queue.ts` は processMedia polling、job state 更新、Rust thumbnail batch IPC、Tauri event transport の adapter に縮退している。app 側に残る主な差分は downloader I/O、Rust watcher ingress、SSE/Tauri event transport、thumbnail 生成の platform I/O である。

| 領域                          | server                                                                                                                   | tauri                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| job repository                | `JobRepository`（`createJobRepository(() => db)`）                                                                       | `TauriJobRepository`（`createJobRepository(() => getTauriAppServices().db)`） |
| ジョブキュー / worker         | `JobWorker`（shared re-export）                                                                                          | `tauri-job-queue.ts`（shared worker bootstrap adapter）                       |
| dispatch / canonical job type | `packages/application/src/services/job-runtime.ts` を利用                                                                | 同左                                                                          |
| background startup            | `BackgroundJobsCoordinator` + `file-watcher-service.ts` adapter                                                          | `BackgroundJobsCoordinator` + `source-service.ts` / maintenance adapter       |
| processMedia payload          | `{ mediaId, sourcePath, steps?, type: "processMedia" }`                                                                  | 同左                                                                          |
| processMedia 実行             | `process-media-runner.ts` + `media-processing-service.ts` adapter                                                        | `process-media-runner.ts` batch runner + `tauri-job-queue.ts` adapter         |
| download runner               | `packages/application/src/services/download-job-runner.ts` + `download-jobs.ts` adapter                                  | 同左 + `imports-api.ts` adapter                                               |
| tagging runner                | `packages/application/src/services/tagging-job-runner.ts` + `tagging-jobs.ts` adapter                                    | 同左 + `ai-service.ts` adapter                                                |
| watcher reconciliation        | `packages/application/src/services/watcher-runtime.ts` + `file-watcher-service.ts` / `directory-sync-service.ts` adapter | 同左 + `source-service.ts` adapter                                            |
| job / media event contract    | `packages/application/src/services/runtime-events.ts` + `sse-manager.ts` transport                                       | 同左 + Tauri event bus transport                                              |
| サムネイル                    | `thumbnails.ts` adapter                                                                                                  | Rust batch IPC adapter                                                        |
| ファイル監視 ingress          | `file-watcher-service.ts`（TS / chokidar wiring）                                                                        | `watcher.rs`（Rust ingress）                                                  |

## 共通化の優先度メモ

| 優先度 | 領域                             | 必要な作業                                                                                                                                        | 状態     |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 中     | Components（media-list-actions） | `MediaListActions` は app 側でまだ個別に組み立てられている。shared component 化の余地あり                                                      | 部分完了 |
| 中     | Routes（source-media-page）      | `SourceMediaScreen` + `SourceMediaGrid` 共通化済み。残る差分は `renderItem` prop と `renderJobProgress` のみ                                      | ほぼ完了 |
| 中     | Services                         | `packages/application` 利用範囲を広げ、tauri の media-service / source-backup-service を薄い adapter に縮退                                       | 部分完了 |
| 中     | Hooks                            | `use-media-source-events` の transport adapter は既に薄い。`use-search-page` / `use-sources-page` / `use-source-media-page` / `use-manager-page` は完了 | 完了     |
| 低     | Repositories                     | 主要 CRUD は shared factory 化済み。残るは app-config など platform 固有 repository                                                                 | ほぼ完了 |
| 低     | Jobs                             | processMedia orchestration / download / tagging / watcher helper は shared 化済み。残るのは transport、downloader I/O、thumbnail の platform 部分 | 部分完了 |
| 対象者 | API Routes                       | 設計思想が異なるため共通化不要                                                                                                                    | 該当なし |

## 保守メモ

- route / component の parity だけでなく、`packages/application` / `packages/db` への引き上げ余地も毎回確認する
- 新しい例外を追加する場合は、なぜ transport 差分や platform 固有事情で分離が必要なのかを明記する
- 片側だけ変更して完了にしない。未対応なら、もう片側への影響か未対応理由を必ず残す
- PGlite は共通化を諦める理由ではなく、shared repository / executor 注入で吸収する前提で扱う
- import inbox の pending queue は `localStorage` を廃止し、server / tauri とも `jobs` table の `import_request` を source of truth とする
- import request の `bulkAdd / listPending / process / cancel` は `packages/application/src/services/import-request-service.ts` を正とし、server / tauri は restore / execute / event publish の adapter だけを注入する

## 再監査メモ（2026-04-29 — SourceMediaGrid 共通化後）

- route ファイル名は揃っており、search / sources / manager / config / source-media は shared screen + shared hook + shared grid 化により「同一」に近い。`source-media-page` の tauri 側 `renderGrid` 差分は `SourceMediaGrid` 共通化で解消
- hook は `use-search-page` / `use-sources-page` / `use-source-media-page` / `use-manager-page` / `use-current-search-persistence.ts` / `use-media-source-events.ts` が `packages/ui` の shared hook を使う構成へ寄った。未共通なのは transport adapter と relevance filter の層
- repository は author / category / character / collection / ip / media / preset / project / source / tag / user / job が shared factory 化済み。主要 CRUD repository の非対称はほぼ解消され、残る app 固有 repository は `app-config-repository.ts` など platform 固有層が中心
- service は CRUD 系の shared 利用がほぼ完了。`source-service.ts` は shared `createSourceService` を使う形へ前進。`media-service.ts` は shared `packages/application/src/services/media-service.ts` を使う形へ前進し、metadata 抽出・context metadata 更新は shared 化済み。残る未 shared 部分は upload collision resolution algorithm など
- jobs は worker 共有の段階を超え、download / tagging / watcher reconciliation / event publish contract / processMedia orchestration まで `packages/application` に寄った。未共通なのは transport と platform I/O の層

## さらに厳しく見たときの未共通化ポイント

- routes: `search.tsx` / `sources/index.tsx` / `manager.tsx` / `config.tsx` / `source-media-page` は shared screen + shared hook 化により thin wrapper に縮退。差分は transport / renderItem / renderJobProgress / renderNavActions に閉じる
- hooks: `use-search-page` / `use-sources-page` / `use-source-media-page` / `use-manager-page` は shared 化済み。`use-media-source-events.ts` 本体も shared 化済み。今後は transport adapter と event relevance filter の責務をさらに薄くできるかを確認する
- queries / api-clients: `queries/*.ts` と `search-api.ts` などは app ごとに薄く重複しており、transport 注入前提の共通 query option builder に寄せられる余地がある
- services: tauri 側 `source-service.ts` は shared `createSourceService` に寄ったが、`media-service.ts` / `source-backup-service.ts` はまだ shared package 前提の thin adapter にはなっていない
- components: `nav.tsx` を例外としても、nav action slot や source detail action 群は shared 化できる。`MediaListActions` は app 側で個別に組み立てられており shared component 化の余地あり

## 前回からの主な変更点（2026-04-26更新）

- **Repositories / Review follow-up**: Tauri 側 repository wrapper に `drizzle-executor.ts` を追加し、`getTauriDrizzleExecutor()` へ executor 解決を集約。author / category / character / collection / ip / media / preset / project / source / tag / user の wrapper で重複していた `getExecutor` 実装を除去し、記法も統一
- **Repositories**: `TauriCategoryRepository` / `TauriCollectionRepository` / `TauriUserRepository` を追加し、server / tauri とも `@solid-imager/db/repositories/*` の shared factory を使う構成へ揃えた。これで category / collection / user の「shared factory はあるが Tauri wrapper 不在」は解消
- **Services**: `TauriCategoryService` / `TauriCollectionService` / `TauriUserService` を追加し、shared `createCategoryService` / `createCollectionService` / `createUserService` を使う Tauri local-api service を整備。あわせて `local-procedures.ts` に `categories.*` / `collections.*` / `users.*` を追加し、Tauri 側から CRUD を呼べる公開面まで揃えた
- **Services**: `apps/tauri/src/infrastructure/local-api/services/source-service.ts` は shared `createSourceService` を利用する形へ整理。`list/get/testConnection/getStatus` と safe mapping は shared contract へ寄せ、watcher / sync / filesystem / event / queue だけを Tauri adapter として残した
- **Services / Tests**: `packages/application/src/services/media-service.ts` の `registerExistingMedia` を batch lookup (`findAllPathsBySourceId`) と batch upsert 優先の実装へ改善。`packages/application/src/tests/media-service-optimization.test.ts` の期待と揃え、既存パス除外後に新規メディアだけをまとめて登録する流れへ寄せた
- **Hooks**: `packages/ui/src/hooks/use-media-source-events.ts` を source of truth として確認。server / tauri とも app 側は transport 注入だけを担う thin wrapper になっており、`onJobProgress` を含む callback I/F も shared hook に統合済み
- **Repositories**: `packages/db` に `category-repository.ts` / `collection-repository.ts` / `user-repository.ts` が存在し、server wrapper はすでに factory 委譲へ寄っていることを反映。未整備点は「shared factory 不在」ではなく「Tauri wrapper 不在」へ整理

- **Jobs / Components**: import inbox を共通化。`packages/application/src/services/import-request-service.ts` に import request service を追加し、`packages/ui/src/import-review-modal.tsx` / `packages/ui/src/pending-downloads-indicator.tsx` を server / tauri で共有。Tauri の pending queue は `localStorage` から `jobs` table (`type=import_request`) へ移行し、server と同じ保存モデルへ統一
- **Services**: `media-service.ts` を `packages/application/src/services/media-service.ts` に共通化。server 側は既存 constructor/proxy 互換 wrapper、Tauri 側は `IMediaStorage` / `IImageProcessor` / transaction / metadata hook を注入する adapter へ変更。Tauri local procedure の wire 名は維持し、service method 名は server 側 (`searchMedia`, `getMediaDetails`, `uploadMedia` など) へ寄せた
- **Repositories（PR #267 レビュー対応）**: author factory に `orderByName` オプションを追加し Tauri wrapper で有効化（旧 `asc(name)` ソートを復元）。update に `isUniqueViolation → ResourceConflictError` を追加し他 repo と整合。tag `addTagsToMedia` で (name, type) のデデュープと、挿入後 lookup 失敗時の log+skip（flatMap）に変更
- **Repositories**: `packages/db` を追加し、author / character / ip / preset / project / source / tag の 7 repository と media-search ユーティリティを factory 形式で共通化。server / tauri は `createXRepository(getExecutor)` を呼ぶだけの薄い wrapper に縮退。重複していた server 側 `authors-repository.ts` は削除
- **Hooks**: `use-current-search-persistence.ts` は共通化済み。`use-media-source-events.ts` も現在は shared hook + app 別 transport の構成へ進んでいる
- **Components**: `SearchControlPanel`, `SearchFilters`, `PresetManager`, `AssociationManager` が `packages/ui` に実装済み。server/tauri 両方で `@solid-imager/ui/search-control-panel` を import 使用
- **Services**: `maintenance-service.ts` を `packages/application/src/services/maintenance-service.ts` に共通化。server は Node fs + `getSourceCacheDir()` adapter、Tauri は `thumbnailDir` 解決と `tauriJobQueue.registerQueuedSources()` adapter に縮退
- **Services**: `packages/application` は増えており、tauri 側 source は shared service 利用へ前進した。watcher / sync の削除・変更経路は shared helper を使う段階まで寄ったが、media / backup はまだ app 固有責務が大きい
- **Services対応度**: 単純 CRUD と config / maintenance は前進したが、source / media / search / backup / ai / tagging を含む主機能の parity はなお過渡期
- **Jobs**: media-processing job の step 定義・payload helper に加え、canonical job type / shared dispatcher / deferred actions executor / background coordinator / download runner / tagging runner / watcher runtime / event publish contract / processMedia batch runner / source progress tracker を `packages/application` に移動。server / tauri は共通 runtime を使い、差分は downloader / thumbnail I/O / watcher ingress / SSE or Tauri event transport に縮退
- **Hooks / Routes**: `packages/ui/src/hooks/use-search-page.ts` を新設し、`search.tsx` の infinite query 構築、結果重複排除、スクロール位置復元、無限スクロール IntersectionObserver を shared hook へ切り出し。`apps/server/src/routes/search.tsx` と `apps/tauri/src/routes/search.tsx` は両方ともこの shared hook を利用。app 側に残る差分は JSX レイアウト（Portal vs inline Dialog）、refresh 戦略（server: 即時 invalidate / tauri: debounce 300ms + `onAllJobsCompleted`）、`sourceRootPath` 注入、SSR `isMounted` ガードなど platform 固有層のみ
- 対応度の推定値を再補正（Routes ~78%、Hooks ~80%、Components ~80%、Repositories ~88%、Services ~68%、Jobs ~82%）

## 前回からの主な変更点（2026-04-29更新 — SourceMediaGrid 共通化）

- **Components / SourceMediaGrid**: `packages/ui/src/source-media-grid.tsx` を新設。server 側 `MediaGrid` と tauri 側の inline `renderGrid` を統合し、shared grid component へ切り出し。機能:
  - CSS grid（`grid-cols-2 md:grid-cols-3 lg:grid-cols-5`）をベースとし、オプションで `@tanstack/solid-virtual` による行 virtualization をサポート（`enableVirtualization` prop）
  - result count 表示、empty state、loading state、context menu（Delete / Copy / Move / Sync Metadata / Open in New Tab）を内包
  - app 固有の item 描画は `renderItem` prop で注入。server は `<a>` + `ThumbnailImage`（HTTP API）、tauri は `<Link>` + `ThumbnailImage`（local fs + blob）をそれぞれ渡す
  - tauri は `enableVirtualization={true}` で仮想化有効化。server はデフォルト（plain grid）
- **Screens / SourceMediaScreen**: `renderGrid` prop を廃止し、`renderItem` prop + `enableVirtualization` prop に置き換え。内部で `SourceMediaGrid` を直接使用
- **Server**: `apps/server/src/routes/sources/$mediaSourceId/components/media-grid.tsx` を削除。`source-media-page.tsx` は `renderItem` prop で `MediaGridItem` を返すのみに縮退
- **Tauri**: `apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx` から 245 行の inline grid 実装（virtual grid + context menu + empty state）を削除（501 → 256 行）。`renderItem` prop + `enableVirtualization={true}` に置き換え
- **対応度見直し**: Routes ~88% → ~95%、Components ~85% → ~92%

## 前回からの主な変更点（2026-04-29更新）

- **Routes / Search**: `search.tsx` を `SearchScreen` (`packages/ui/src/screens/search-screen.tsx`) + `useSearchPage` (`packages/ui/src/hooks/use-search-page.ts`) へ完全共通化。server / tauri 両方の route は loader + query adapter + `renderNavActions` / `renderMediaItem` prop 注入の thin wrapper に縮退。差分は Portal vs inline header、refresh 戦略（server: 即時 invalidate / tauri: debounce 300ms + `onAllJobsCompleted`）、`sourceRootPath` 注入、SSR guard のみ
- **Routes / Sources**: `sources/index.tsx` を `SourcesScreen` (`packages/ui/src/screens/sources-screen.tsx`) + `useSourcesPage` (`packages/ui/src/hooks/use-sources-page.ts`) へ共通化。event transport 差分は `registerEvents` prop で吸収し、server 側は SSE、tauri 側は Tauri event bus をそれぞれ adapter として注入
- **Routes / SourceMedia**: `source-media-page` を `SourceMediaScreen` (`packages/ui/src/screens/source-media-screen.tsx`) + `useSourceMediaPage` (`packages/ui/src/hooks/use-source-media-page.ts`) へ共通化。server 側は `MediaGrid` component に切り出し比較的薄くなったが、tauri 側は `renderGrid` prop 内に virtual grid (`@tanstack/solid-virtual`)、context menu、job progress の独自実装を残しており、shared grid component への寄せが未完了
- **Routes / Config**: `config-form.tsx` を `ConfigScreen` (`packages/ui/src/screens/config-screen.tsx`) へ共通化。server / tauri の `config.tsx` route はほぼ同一になり、差分は `onSubmitSuccess` callback（tauri: `resetThumbnailRuntimeCache`）のみ
- **Routes / Manager**: 既存の `ManagerScreen` + `useManagerPage` 共有を維持し、両 app の `manager.tsx` は batch job event transport + media card render prop 注入の thin wrapper

- **Hooks**: `use-sources-page.ts` と `use-source-media-page.ts` を新設。sources / source-media の状態管理・副作用・イベントハンドリングを shared hook へ移動
- **Screens (packages/ui)**: `SearchScreen`、`SourcesScreen`、`SourceMediaScreen`、`ConfigScreen` を新設。今後の route 共通化はこれらの screen component + shared hook の組み合わせを基本形とする

- **Services / Type Safety**: PR #289 により、tauri 側 `orpc-client.ts` の type safety を改善。`packages/core/src/interfaces/media-manager-client.ts` の interface を拡張し、media API クライアントの型安全性を向上
- **Services / Tauri Sync**: `ef00c6b` で tauri 側の各種 service、repository、api-client を server 側の変更に追従。型エラー修正と shared package 利用の拡大

- **Components / SourceMedia**: `MediaGrid` (server) は app 側 component として切り出されたが、tauri 側は inline virtual grid 実装のまま。`MediaListActions` も app 側で個別に組み立てられている
- **対応度見直し**: Routes ~75% → ~88%、Hooks ~75% → ~85%、Components ~80% → ~85%、Services ~68% → ~72%、Repositories ~88% → ~92%、Jobs ~82% → ~85%

## 前回からの主な変更点（2026-04-27更新）

- **Services / Media**: `packages/application/src/services/media-context-metadata.ts` を新設し、`updateMediaContextMetadata` を shared 化。server 側 `MediaProcessingServiceImpl` と tauri 側 `TauriMediaService` の context metadata 更新ロジックを統合。tauri 側の `syncContextMetadata`（Drizzle query 直書き）と `characterRepository.addToMediaBulk` の再実装を削除し、shared `updateMediaContextMetadata` + `packages/db` の `CharacterRepository` を直接使用
- **Services / Media**: `packages/application/src/services/media-metadata-extractor.ts` を新設し、`extractAndPersistMediaMetadata` を shared 化。`MediaServiceImpl` の `extractAndUpdateMetadata` private メソッドを shared 関数へ移動。tauri 側の `persistExtractedMetadata`（Drizzle query 直書き）を削除し、shared 関数を利用
- **Services / Media**: `packages/application/src/services/media-service.ts` の `getMediaDetails` / `reprocessMetadata` を shared `extractAndPersistMediaMetadata` を使う形に変更。server / tauri とも同じ metadata 抽出・保存ロジックを共有
- **Services / Backup**: `packages/application/src/services/backup-restore-complete.ts` を新設し、`enqueueThumbnailJobsAfterRestore` を shared 化。server 側 `backup-service.ts` と tauri 側 `source-backup-service.ts` の restore 後処理を統合。tauri 側に `onRestoreComplete` を追加し、server 側と同じ挙動に揃える
- **Services対応度**: media-service / source-backup-service の主要ロジックを shared 化したことで、Services 対応度は ~75% 程度へ上昇。残る差分は upload collision resolution algorithm（platform 非依存部分の shared 化余地あり）、zip 処理、および platform 固有 I/O 層
