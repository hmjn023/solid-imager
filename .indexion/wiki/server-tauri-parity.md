# server / tauri 実装対応マップ

`apps/server` と `apps/tauri` で同一責務を別実装しているファイルの対応関係。共通化・見直しの際の参照用。

最終更新: 2026-05-01（wave1: #303/#304/#305/#308 完了。Hooks parser 重複解消、media-viewer/thumbnail-image を adapter pattern で shared 化、event-service 削除）

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

## Routes（対応度: ~70%）

主要 route（search / sources / manager / config / source-media）は `packages/ui/src/screens/*` と `packages/ui/src/hooks/use-*-page.ts` を利用する形へ前進したが、**app 側 route は依然として fat wrapper**。shared screen / hook を呼んでいるだけで thin wrapper とみなすのは誤り。実際には以下の重複が双方に残る：

- **filter query wiring**、mobile dialog 組み立て、refresh 戦略（debounce / `onAllJobsCompleted`）
- **event transport の組み立て**（`registerEvents` prop の具象実装）
- **modal/dialog 群の JSX 組み立て**（upload / move-copy / AI tagging / import review 等）
- **route 固有の state / effect**（`sourceRootPath` memo、`notifyThumbnailReady` 等）

| server                                                           | tauri                                                            | 行数（server / tauri） | 備考                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routes/__root.tsx`                                              | `routes/__root.tsx`                                              | 同一                   | 同一                                                                                                                                                                                                                                                                                                                                    |
| `routes/$.tsx`                                                   | `routes/$.tsx`                                                   | 同一                   | 同一                                                                                                                                                                                                                                                                                                                                    |
| `routes/index.tsx`                                               | `routes/index.tsx`                                               | 同一                   | 同一                                                                                                                                                                                                                                                                                                                                    |
| `routes/about.tsx`                                               | `routes/about.tsx`                                               | 同一                   | 同一                                                                                                                                                                                                                                                                                                                                    |
| `routes/config.tsx`                                              | `routes/config.tsx`                                              | ~36 / ~32              | **thin wrapper**。`ConfigScreen` 共有。差分は `onSubmitSuccess` callback のみ                                                                                                                                                                                                                                                           |
| `routes/manager.tsx`                                             | `routes/manager.tsx`                                             | ~102 / ~98             | fat wrapper。`ManagerScreen` + `useManagerPage` は共有だが、batch job event transport wiring、query prefetch、action prop 組み立てが双方に 100 行近く重複                                                                                                                                                                               |
| `routes/search.tsx`                                              | `routes/search.tsx`                                              | ~145 / ~156            | **fat wrapper**。`SearchScreen` + `useSearchPage` は共有だが、filter query wiring、mobile dialog、refresh 戦略（server: 即時 invalidate / tauri: debounce 300ms + `onAllJobsCompleted`）、`renderNavActions`（Portal vs inline）、`sourceRootPath` 注入、SSR `isMounted` ガードが双方に残る                                             |
| `routes/sources/index.tsx`                                       | `routes/sources/index.tsx`                                       | ~134 / ~125            | **fat wrapper**。`SourcesScreen` + `useSourcesPage` は共有だが、`registerEvents` の具象実装（SSE stream + `AbortController` vs Tauri `listen`）が双方に完全に重複。event handler の本体は同一だが transport 切り替え以外のロジックも含む                                                                                                |
| `routes/sources/$mediaSourceId/index.tsx`                        | `routes/sources/$mediaSourceId/index.tsx`                        | ~24 / ~22              | **thin wrapper**。loader + query prefetch のみ                                                                                                                                                                                                                                                                                          |
| `routes/sources/$mediaSourceId/components/source-media-page.tsx` | `routes/sources/$mediaSourceId/components/source-media-page.tsx` | ~169 / ~208            | **fat wrapper**。`SourceMediaScreen` + `useSourceMediaPage` + `SourceMediaGrid` は共有だが、transport factory（`createServerTransport` / `createTauriTransport`）、modal/dialog 群の JSX 組み立て、`sourceRootPath` memo、`notifyThumbnailReady` 等が app 側に 100-200 行残る。`renderItem` prop 注入は薄いが、route ファイル全体は fat |
| `routes/sources/$mediaSourceId/$mediaId/index.tsx`               | `routes/sources/$mediaSourceId/$mediaId/index.tsx`               | 同一                   | 同一                                                                                                                                                                                                                                                                                                                                    |
| `routes/api/rpc.$.ts`                                            | ―（Rust IPC）                                                    | —                      | oRPC vs Tauri IPC                                                                                                                                                                                                                                                                                                                       |
| `routes/api/events.ts`                                           | ―（Rust IPC）                                                    | —                      | SSE vs Tauri event                                                                                                                                                                                                                                                                                                                      |
| `routes/api/sources.$mediaSourceId.dump.ts`                      | ―                                                                | —                      | serverのみ                                                                                                                                                                                                                                                                                                                              |
| `routes/api/sources.$mediaSourceId.import.ts`                    | ―                                                                | —                      | serverのみ                                                                                                                                                                                                                                                                                                                              |
| `routes/api/sources.$mediaSourceId.$mediaId.ts`                  | ―                                                                | —                      | serverのみ（メディアファイル配信）                                                                                                                                                                                                                                                                                                      |
| `routes/api/sources.$mediaSourceId.$mediaId.thumbnail.ts`        | ―                                                                | —                      | serverのみ（サムネイル配信）                                                                                                                                                                                                                                                                                                            |
| `routes/docs/swagger/index.tsx`                                  | ―                                                                | —                      | serverのみ（Swagger UI）                                                                                                                                                                                                                                                                                                                |

## Hooks（対応度: ~75%）

ページ状態管理 hook（`use-search-page` / `use-sources-page` / `use-source-media-page` / `use-manager-page`）は `packages/ui` へ共有化され、双方から利用されている。**ただし event transport hook には依然として重複 parser/filter ロジックが残る。** `use-media-source-events.ts` の本体は shared 化されたが、app 側の transport wrapper に `SafeParseSchema` 型定義や schema-safe payload parser（`parseJsonEventPayload` / `parseEventPayload`）が双方で重複しており、これらは `packages/ui` または `packages/core` に寄せられる。

| ファイル名                          | server実装                                                    | tauri実装                                                                       | 差異                                             | 備考                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-media-source-events.ts`        | `packages/ui` の shared hook + oRPC SSE transport wrapper     | `packages/ui` の shared hook + Tauri event transport wrapper                    | transport 実装と event relevance filter が異なる | wrapper は ~83-111行。`onJobProgress` を含む callback I/F は shared hook 側へ統合済み                                                           |
| `use-batch-job-events.ts`           | `/api/events` SSE を購読し shared manager job handlers へ委譲 | Tauri `listen` と core event schema で購読し shared manager job handlers へ委譲 | transport のみ                                   | wrapper は ~40-50行。`SafeParseSchema` / `parseJsonEventPayload` / `parseEventPayload` は `packages/core/src/utils/event-parsers.ts` に抽出済み |
| `use-current-search-persistence.ts` | `packages/ui` 経由で `@solid-imager/core`                     | `packages/ui` 経由で `@solid-imager/core`                                       | 共通化済み                                       | deepEqualはcore/utils/deep-equal                                                                                                                |
| `use-search-page.ts`                | `packages/ui` の shared hook                                  | `packages/ui` の shared hook                                                    | 共通化済み                                       | infinite query / dedup / scroll restore / observer を shared 化                                                                                 |
| `use-sources-page.ts`               | `packages/ui` の shared hook                                  | `packages/ui` の shared hook                                                    | 共通化済み                                       | source CRUD / sync / event の状態管理を shared 化                                                                                               |
| `use-source-media-page.ts`          | `packages/ui` の shared hook                                  | `packages/ui` の shared hook                                                    | 共通化済み                                       | source media の検索 / upload / dump / restore / move/copy を shared 化                                                                          |
| `use-manager-page.ts`               | `packages/ui` の shared hook                                  | `packages/ui` の shared hook                                                    | 共通化済み                                       | manager の CRUD / batch tagging 状態管理を shared 化                                                                                            |

## Queries / API Clients（対応度: ~95%）

`packages/ui/src/query-options/` を新設し、`authors` / `characters` / `config` / `ips` / `media-details` / `projects` / `sources` / `tags` の 8 クエリについて `queryOptions` builder、query key 定義、デフォルトキャッシュ設定を shared 化。server / tauri の `infrastructure/api-clients/queries/*.ts` は shared builder に `fetch*` 関数を注入する 4-7 行の thin wrapper に縮退。route ファイルの import パスと関数名は変更なし。

| ファイルパターン | server              | tauri               | 評価                                        |
| ---------------- | ------------------- | ------------------- | ------------------------------------------- |
| `queries/*.ts`   | 4-7行の wrapper     | 4-7行の wrapper     | **thin wrapper 化完了**                     |
| `search-api.ts`  | `orpc.media.search` | `orpc.media.search` | 同一。将来 shared util に寄せられる余地あり |

## Components（対応度: ~60%）

**leaf component（button, input, dialog 等）の共有は進んだが、ページ単位の複合コンポーネントは `packages/ui` になく、双方に 300-500 行ずつ完全に重複している。** `SourceMediaGrid` など一部の shared component は抽出されたが、media sidebar、form modal、upload modal など主要な複合 UI は依然として app 側に残存。route が fat wrapper である根本理由の一つが、これらの複合コンポーネントが shared 化されていないこと。

### 対応あり（shared 化完了 or 近い）

| ファイル名                                | 行数（server / tauri） | 差異のポイント                                                                                                                                               |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nav.tsx`                                 | —                      | Tauri版がナビゲーションバーのマスター。serverのものをTauriに合わせること（例外）                                                                             |
| `source-card.tsx`                         | ほぼ同一               | ほぼ同一                                                                                                                                                     |
| `source-delete-modal.tsx`                 | ~51 / ~51              | 同一。`packages/ui` 未配置だが内容が同一                                                                                                                     |
| `media/search-filters.tsx`                | —                      | `packages/ui/shared`                                                                                                                                         |
| `media/preset-manager.tsx`                | —                      | `packages/ui/shared`                                                                                                                                         |
| `media/association-manager.tsx`           | —                      | `packages/ui/shared`                                                                                                                                         |
| `imports/import-review-modal.tsx`         | ~24 / ~29              | `packages/ui/import-review-modal.tsx` を共有。app 側は data/action adapter のみ                                                                              |
| `imports/pending-downloads-indicator.tsx` | ~33 / ~43              | `packages/ui/pending-downloads-indicator.tsx` を共有。app 側は event subscription adapter のみ                                                               |
| `media/source-media-grid.tsx`             | —                      | `packages/ui/src/source-media-grid.tsx` を新設。server / tauri で共有。差分は `renderItem` prop のみ                                                         |
| `media/media-list-actions.tsx`            | —                      | `packages/ui/src/media-list-actions.tsx` を新設。server / tauri で共有。差分は `presetClient` prop 注入のみ                                                  |
| `media/media-viewer.tsx`                  | ~58 / ~96              | `packages/ui/src/media-viewer.tsx` を新設。`MediaSource` adapter pattern で shared 化。server/tauri は adapter 生成 + shared component 呼び出しに縮退        |
| `media/thumbnail-image.tsx`               | ~70 / ~233             | `packages/ui/src/thumbnail-image.tsx` を新設。`ThumbnailSource` adapter pattern で shared 化。server/tauri は adapter 生成 + shared component 呼び出しに縮退 |

### 重複が残る複合コンポーネント（`packages/ui` にない）

| ファイル名                                          | 行数（server / tauri） | 評価                                                                                                                                          |
| --------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `media/media-sidebar-content.tsx`                   | **519 / 501**          | **最大の重複**。両 app に 500行超の完全重複。sidebar 内の全フォーム・タグ編集・関連付け・メタデータ表示が同一責務なのに shared 化されていない |
| `source-form-modal/source-form-modal-content.tsx`   | **430 / 168**          | **重大な重複+乖離**。server 版が 430行で tauri 版が 168行。責務分割の問題。フォーム本体を `packages/ui` に寄せる余地が大きい                  |
| `upload-media-modal/upload-media-modal-content.tsx` | **333 / 280**          | **重大な重複**。両 app に 280-330行の upload ロジック（ドラッグ&ドロップ、ファイル選択、衝突解決表示）が完全に重複                            |
| `media/media-card-item.tsx`                         | ~107 / ~80             | 重複。checkbox API、CSS class、Link vs `<a>`、`sourceRootPath` prop の差分                                                                    |
| `media/media-grid-item.tsx`                         | ~66 / ~55              | 重複。`<a>` vs `<Link>`、`sourceRootPath` prop の差分                                                                                         |
| `media/move-copy-media-dialog.tsx`                  | ~116 / ~107            | ほぼ同一だが依然として `packages/ui` にない                                                                                                   |
| `media/pro-search-dialog.tsx`                       | ほぼ同一               | ほぼ同一だが `packages/ui` にない                                                                                                             |
| `media/ai-tagging-modal.tsx`                        | ほぼ同一               | ほぼ同一だが `packages/ui` にない                                                                                                             |
| `media/pro-search-builder.tsx`                      | ほぼ同一               | ほぼ同一だが `packages/ui` にない                                                                                                             |
| `media/search-control-panel.tsx`                    | ほぼ同一               | ほぼ同一だが `packages/ui` にない                                                                                                             |
| `media/sort-controls.tsx`                           | ほぼ同一               | ほぼ同一だが `packages/ui` にない                                                                                                             |

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

## Services（対応度: ~80%）

`packages/application` の追加自体は前進し、CRUD 系はほぼ shared 化完了。source / media / backup など主機能も shared contract を使う形へ前進。tauri 側 `media-service.ts` は `createMediaService` を使う thin adapter に縮退し、`updateMedia`/`copyMedia`/`moveMedia`/`deleteMedia` の public contract を server 側に揃えた。`source-backup-service.ts` も `_` プレフィックス付き内部メソッドの公開を削除し、`createDump`/`importSourceZip` の platform I/O 差分のみを adapter として残す。

共通 service の public method は server 側で元々使っていた命名（例: `getAllAuthors`, `createAuthor`, `getCharactersForMedia`, `searchMedia`, `uploadMedia`）へ揃える方針だが、実装実態はサービスごとにばらつきがある。

厳格基準では、`apps/tauri/src/infrastructure/local-api/services/source-service.ts` は shared `createSourceService` を使う段階まで前進。watcher / sync / filesystem / event / queue orchestration は Tauri adapter 内に残るが、list/get/testConnection/getStatus は shared 化。`media-service.ts` は shared `packages/application/src/services/media-service.ts` を使う thin adapter に縮退。`contextMetadataUpdater` / `afterMediaRegistered` / `extractAndUpdateMetadata` は shared 化済み。`source-backup-service.ts` も shared `createBackupService` を使い、`_` プレフィックス付き内部メソッドの公開を削除。upload collision resolution algorithm も `packages/application/src/services/media-upload-utils.ts` に shared 化し、server / tauri 両側が `resolveUploadTargetPath` を利用。server 側 `server-media-storage.ts` と `download-jobs.ts` の独自実装を削除。残る未 shared 部分は zip 処理など platform 固有 I/O 層。

### service 本体を shared 利用しているもの

| サービス                | 共通実装                                                  | server側 wrapper                                         | tauri側 wrapper                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `author-service.ts`     | `packages/application/src/services/author-service.ts`     | 旧 `getAllAuthors` 等を維持                              | `list/get/create/update/delete` を維持                                                                                                                                                                                 |
| `tag-service.ts`        | `packages/application/src/services/tag-service.ts`        | 旧 `getAllTags` 等を維持                                 | `list/get/create/update/delete` を維持                                                                                                                                                                                 |
| `character-service.ts`  | `packages/application/src/services/character-service.ts`  | 旧 `CharacterServiceImpl` constructor と旧メソッドを維持 | Tauri repository adapter 経由で利用                                                                                                                                                                                    |
| `ip-service.ts`         | `packages/application/src/services/ip-service.ts`         | 旧 `getAllIps` 等を維持                                  | `list/get/create/update/delete/listForMedia` を維持                                                                                                                                                                    |
| `project-service.ts`    | `packages/application/src/services/project-service.ts`    | 旧 `getAllProjects` 等を維持                             | `list/get/create/update/delete/listForMedia` を維持                                                                                                                                                                    |
| `preset-service.ts`     | `packages/application/src/services/preset-service.ts`     | `setPresetRepository` を維持                             | `TauriPresetService` を維持                                                                                                                                                                                            |
| `category-service.ts`   | `packages/application/src/services/category-service.ts`   | `DrizzleCategoryService`（factory 委譲クラス）           | `TauriCategoryService`（thin wrapper）。`list/get/create/update/delete` を維持                                                                                                                                         |
| `collection-service.ts` | `packages/application/src/services/collection-service.ts` | `CollectionService`（thin wrapper）                      | `TauriCollectionService`（thin wrapper）。`list/get/create/update/delete/addToMedia/removeFromMedia` を維持                                                                                                            |
| `user-service.ts`       | `packages/application/src/services/user-service.ts`       | `UserService`（thin wrapper）                            | `TauriUserService`（thin wrapper）。`list/get/create/update/delete` を維持                                                                                                                                             |
| `search-service.ts`     | `packages/application/src/services/search-service.ts`     | server proxy を維持                                      | ―                                                                                                                                                                                                                      |
| `media-service.ts`      | `packages/application/src/services/media-service.ts`      | 旧 `MediaServiceImpl` constructor と proxy を維持        | `TauriMediaService` は `createMediaService` を使う thin adapter。`updateMedia`/`copyMedia`/`moveMedia`/`deleteMedia` の public contract を server 側に揃え、transaction / deferred actions / return shape の差分を解消 |

### 共通化済み（utility / port / payload）

| 領域                      | 共通実装                                                                       | 備考                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `media-processing-job`    | `packages/application/src/services/media-processing-job.ts`                    | server / tauri の step 定義を共有                                                                                                                                              |
| `maintenance-service`     | `packages/application/src/services/maintenance-service.ts`                     | startup recovery の判定・job enqueue を共有。thumbnail path 解決と queue wake は app adapter に残す                                                                            |
| `config-service`          | `packages/application/src/services/config-service.ts`, `utils/config-merge.ts` | Tauri は共通 service、server は config merge utility を使用                                                                                                                    |
| `source-service`          | `packages/application/src/services/source-service.ts`                          | server は shared service を利用。tauri も `createSourceService` を使って list/get/testConnection/getStatus を共有し、watcher / sync / fs / event / queue だけを adapter に残す |
| `backup-service`          | `packages/db/src/backup.ts`                                                    | dump/restore の DB ロジックを共有。zip / fs / command client は app 固有のまま                                                                                                 |
| `backup-restore-complete` | `packages/application/src/services/backup-restore-complete.ts`                 | restore 後の thumbnail job enqueue を shared 化。server / tauri とも利用                                                                                                       |
| TODO stub services        | `packages/application/src/services/stub-services.ts`                           | analytics / bulk-operation / data-migration / filter-preset / integration / workflow                                                                                           |

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

| サービス                      | 存在するapp | 対応するtauri実装                                                             |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `analytics-service.ts`        | serverのみ  | なし                                                                          |
| `backup-service.ts`           | serverのみ  | `source-backup-service.ts`（tauri）                                           |
| `bulk-operation-service.ts`   | serverのみ  | なし                                                                          |
| `category-service.ts`         | serverのみ  | `TauriCategoryService`（local-api/services/）                                 |
| `collection-service.ts`       | serverのみ  | `TauriCollectionService`（local-api/services/）                               |
| `data-migration-service.ts`   | serverのみ  | なし                                                                          |
| `directory-service.ts`        | serverのみ  | なし                                                                          |
| `directory-sync-service.ts`   | serverのみ  | `syncLocalSource`（`source-service.ts` tauri）— Rust backend パイプライン経由 |
| `filter-preset-service.ts`    | serverのみ  | なし                                                                          |
| `integration-service.ts`      | serverのみ  | なし                                                                          |
| `job-dispatch-service.ts`     | serverのみ  | `tauri-job-queue.ts` + Rust backend 統合パイプライン                          |
| `media-processing-job.ts`     | serverのみ  | `process-media-job.ts`（tauri、型定義 re-export）                             |
| `media-processing-service.ts` | serverのみ  | Rust commands (`media.rs` / `media_metadata.rs`) + `tauri-job-queue.ts`       |
| `media-source-service.ts`     | serverのみ  | `source-service.ts`（tauri）                                                  |
| `search-service.ts`           | serverのみ  | tauri は API client 経由で利用し、service wrapper は未整備                    |
| `server-config-service.ts`    | serverのみ  | `config-service.ts`（tauri）                                                  |
| `tagging-service.ts`          | serverのみ  | なし                                                                          |
| `thumbnail-service.ts`        | serverのみ  | なし                                                                          |
| `user-service.ts`             | serverのみ  | `TauriUserService`（local-api/services/）                                     |
| `workflow-service.ts`         | serverのみ  | なし                                                                          |

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

## 共通化の優先度メモ（2026-05-01 更新）

| 優先度     | 領域                                            | 必要な作業                                                                                                                                   | 状態     |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **高**     | **Components / media-sidebar-content.tsx**      | 519+501行の完全重複を `packages/ui/src/media-sidebar.tsx` へ抽出。app 側は data adapter + action callback 注入の thin wrapper に縮退         | 未着手   |
| **高**     | **Components / source-form-modal-content.tsx**  | 430+168行の乖離を `packages/ui` へ寄せ。差分は validation rule / submit adapter で吸収                                                       | 未着手   |
| **高**     | **Components / upload-media-modal-content.tsx** | 333+280行の重複を `packages/ui` へ抽出。ドラッグ&ドロップ、ファイル選択、衝突解決表示を共有                                                  | 未着手   |
| **高**     | **Routes / search.tsx**                         | filter query wiring、mobile dialog、refresh 戦略を `SearchScreen` 側へ吸収。route は transport 注入 + render prop のみに縮退                 | 未着手   |
| **高**     | **Routes / sources/index.tsx**                  | `registerEvents` の具象実装を shared hook または `packages/ui` へ寄せ。event handler 本体は同一なのに transport 切り替え以外のロジックも含む | 未着手   |
| **中**     | **Components / thumbnail-image.tsx**            | HTTP retry vs local file + blob URL + runtime 購読 を `ThumbnailSource` adapter pattern で抽象化                                             | 未着手   |
| **中**     | **Components / media-viewer.tsx**               | HTTP source vs local file source を `MediaSource` adapter で抽象化（難易度高）                                                               | 未着手   |
| **中**     | **Hooks / use-batch-job-events.ts**             | `SafeParseSchema` 型と `parseJsonEventPayload` / `parseEventPayload` を `packages/ui` または `packages/core` へ抽出                          | 未着手   |
| **中**     | **Routes / manager.tsx**                        | batch job event transport wiring、query prefetch、action prop 組み立てを `ManagerScreen` 側へ吸収                                            | 未着手   |
| **中**     | **Routes / source-media-page.tsx**              | transport factory、modal/dialog 群の JSX 組み立てを `SourceMediaScreen` 側へ吸収                                                             | 未着手   |
| **低**     | **Components（その他）**                        | `media-card-item.tsx` / `media-grid-item.tsx` / `move-copy-media-dialog.tsx` 等を `packages/ui` へ配置。優先度は低い                         | 未着手   |
| **低**     | **Repositories**                                | 主要 CRUD は shared factory 化済み。残るは app-config 等 platform 固有 repository                                                            | ほぼ完了 |
| **低**     | **Jobs**                                        | processMedia orchestration / download / tagging / watcher helper は shared 化済み。残るは transport / thumbnail I/O / watcher ingress        | 部分完了 |
| **低**     | **Services**                                    | CRUD / media / backup / ai tagging は shared 化済み。残るは platform 固有 I/O（zip stream / HTTP URL / storage driver）とレガシーサービス    | ほぼ完了 |
| **対象外** | **API Routes**                                  | 設計思想が異なるため共通化不要                                                                                                               | 該当なし |
| **対象外** | **nav.tsx**                                     | Tauri 版をマスターとする例外。server 側は Tauri 版に寄せない                                                                                 | 該当なし |

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
- service は CRUD 系の shared 利用がほぼ完了。`source-service.ts` は shared `createSourceService` を使う形へ前進。`media-service.ts` は shared `packages/application/src/services/media-service.ts` を使う thin adapter に縮退し、`updateMedia`/`copyMedia`/`moveMedia`/`deleteMedia` の public contract を server 側に揃えた。`source-backup-service.ts` も shared `createBackupService` を使い、`_` プレフィックス付き内部メソッドの公開を削除。upload collision resolution algorithm も `packages/application/src/services/media-upload-utils.ts` に shared 化し、server / tauri 両側が `resolveUploadTargetPath` を利用。server 側 `server-media-storage.ts` と `download-jobs.ts` の独自実装を削除。残る未 shared 部分は zip 処理など platform 固有 I/O 層
- jobs は worker 共有の段階を超え、download / tagging / watcher reconciliation / event publish contract / processMedia orchestration まで `packages/application` に寄った。未共通なのは transport と platform I/O の層

## さらに厳しく見たときの未共通化ポイント（2026-05-01 更新）

### 重大（次のマイルストーンで対応必須）

1. **Components / `media-sidebar-content.tsx`** — **519 + 501 行の完全重複**。sidebar 内の全フォーム・タグ編集・関連付け・メタデータ表示が `packages/ui` にない。`packages/ui/src/media-sidebar.tsx` として抽出し、app 側は data adapter + action callback を注入する thin wrapper に縮退すべき
2. **Components / `source-form-modal-content.tsx`** — **430 + 168 行の乖離**。server 版が 430行で tauri 版が 168行。フォーム本体を `packages/ui` に寄せ、差分は validation rule / submit adapter で吸収
3. **Components / `upload-media-modal-content.tsx`** — **333 + 280 行の完全重複**。ドラッグ&ドロップ、ファイル選択、衝突解決表示を `packages/ui` に抽出
4. **Routes / `search.tsx`** — ~145 + ~156 行。filter query wiring、mobile dialog、refresh 戦略が双方に重複。`SearchScreen` 側で吸収できる責務が route に漏れている
5. **Routes / `sources/index.tsx`** — ~134 + ~125 行。`registerEvents` の具象実装（SSE stream vs Tauri `listen`）が双方に完全に重複。event handler の本体は同一だが transport 切り替え以外のロジックも含む

### 中程度（後続タスク）

6. **Components / `thumbnail-image.tsx`** — 84 + 238 行。HTTP retry vs local file + blob URL + `thumbnail-runtime` 購読。**`renderStrategy` prop または `ThumbnailSource` adapter pattern で抽象化可能**
7. **Components / `media-viewer.tsx`** — 49 + 150 行。HTTP source vs local file source。**抽象化は難易度が高いが、`MediaSource` adapter で切り出せる余地あり**
8. **Hooks / `use-batch-job-events.ts`** — 80 + 94 行。**`SafeParseSchema` 型と `parseJsonEventPayload` / `parseEventPayload` 関数が双方で完全に重複**。`packages/ui` または `packages/core` に抽出可能
9. **Routes / `manager.tsx`** — ~102 + ~98 行。batch job event transport wiring、query prefetch、action prop 組み立てが双方に ~100行重複
10. **Routes / `source-media-page.tsx`** — ~169 + ~208 行。transport factory、modal/dialog 群の JSX 組み立てが残る

### 軽微（現状維持可）

- `media-card-item.tsx` / `media-grid-item.tsx` — `<a>` vs `<Link>`、`sourceRootPath` prop の差分。`renderItem` prop で既に抽象化されているが、component 自体の重複が残る
- `nav.tsx` — Tauri 版をマスターとする例外。server 側は Tauri 版に寄せない方針
- `move-copy-media-dialog.tsx` / `pro-search-dialog.tsx` / `ai-tagging-modal.tsx` 等 — 内容はほぼ同一だが `packages/ui` に未配置。優先度は低い

### services / jobs / repositories

- services: CRUD / media / backup / ai tagging は shared 化済み。残るは platform 固有 I/O（zip stream / HTTP URL / storage driver）とレガシーサービス。評価 ~85% は妥当
- jobs: worker / runner / orchestration は shared 化済み。残るは transport / thumbnail I/O / watcher ingress。評価 ~85% は妥当
- repositories: 主要 CRUD は shared factory 化済み。残るは app-config 等 platform 固有 repository。評価 ~90% は妥当

## 再監査メモ（2026-05-01 — 実態ベースの対応度再評価）

- **Routes**: 自己評価 ~95% は過大評価。実際には `search.tsx`（145+156行）、`sources/index.tsx`（134+125行）、`manager.tsx`（102+98行）、`source-media-page.tsx`（169+208行）がいずれも fat wrapper。shared screen / hook を呼んでいるが、filter query wiring、event transport 組み立て、modal/dialog JSX、refresh 戦略、route 固有 state が双方に 100-200行ずつ残る。`config.tsx`（36+32行）のみが真の thin wrapper。実態評価は **~70%**
- **Components**: 自己評価 ~92% は過大評価。leaf component（button, input, dialog）の共有は進んだが、**ページ単位の複合コンポーネント**（media-sidebar-content 519+501行、source-form-modal-content 430+168行、upload-media-modal-content 333+280行）が `packages/ui` になく双方に完全に重複。media-viewer（49+150行）と thumbnail-image（84+238行）は完全に別物。実態評価は **~55%**
- **Hooks**: 自己評価 ~85% はやや過大評価。`use-search-page` / `use-sources-page` / `use-source-media-page` / `use-manager-page` は shared 化完了だが、`use-batch-job-events.ts`（80+94行）に `SafeParseSchema` 型と parser 関数の完全重複が残る。`use-media-source-events.ts`（83+111行）の transport wrapper もまだ厚い。実態評価は **~75%**
- **Queries**: PR #297 で shared 化。双方 4-7行の thin wrapper に縮退。実態評価 **~95%** — これだけは本当にできている
- **Repositories**: 自己評価 ~92% は概ね正しい。主要 CRUD は shared factory 化済み。実態評価 **~90%**
- **Services**: 自己評価 ~95% はやや過大評価。CRUD / media / backup / ai tagging は shared 化されたが、tauri 側 local-api adapter は依然として大きい。実態評価 **~85%**
- **Jobs**: 自己評価 ~85% は概ね正しい。worker / runner / orchestration は shared 化済み。実態評価 **~85%**

**総括**: wiki の対応度は「shared package を import しているファイル数」ではなく、「app 側ファイルが thin wrapper（transport 注入のみ）に縮退しているか」で判断すべき。現状では routes と components が最大の未共通化ポイント。

## 前回からの主な変更点（2026-04-30更新）

- **Query Options**: `packages/ui/src/query-options/` を新設。`authors` / `characters` / `config` / `ips` / `media-details` / `projects` / `sources` / `tags` の 8 クエリについて、`queryOptions` builder と query key 定義、デフォルトキャッシュ設定を shared 化。server / tauri の `infrastructure/api-clients/queries/*.ts` は shared builder に `fetch*` 関数を注入する thin wrapper に縮退。route ファイルの import パスと関数名は変更なし
- **Services**: `apps/tauri/src/infrastructure/local-api/services/media-service.ts` の `TauriMediaService` を shared `createMediaService` の thin adapter に縮退。`updateMedia` の `getMediaDetails` 追加呼び出しを削除、`copyMedia`/`moveMedia` の transaction 手動ラップを削除し shared の deferred actions に委譲、`deleteMedia` を `void` に。`apps/server/src/infrastructure/api/routers/media-router.ts` の `copy`/`move` も `{ success: true }` に揃え、`MutationSuccess` contract を統一
- **Services**: `apps/tauri/src/infrastructure/local-api/services/source-backup-service.ts` から `_filterValidItems` / `_restoreMasterData` / `_restoreMediaRecords` / `_mapMediaPathsToIds` / `_transformMediaList` / `_restoreRelations` などの `_` プレフィックス付き内部メソッド公開を削除。`createDump`/`importSourceZip` の platform I/O 差分のみを adapter として残す

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
- **Services対応度**: media-service / source-backup-service の主要ロジックを shared 化したことで、Services 対応度は ~75% 程度へ上昇。残る差分は zip 処理および platform 固有 I/O 層

## 前回からの主な変更点（2026-04-30更新 — Services 全面共通化）

- **Services / CRUD Naming**: `packages/application/src/services/{author,tag,character,ip,project,category,collection,user}-service.ts` のメソッド名を `getAll*` / `get*Details` / `create*` / `update*` / `delete*` から `list` / `get` / `create` / `update` / `delete` / `listForMedia` / `addToMedia` / `removeFromMedia` に一括統一。server / tauri 両方の wrapper、oRPC router、local-procedures を追随
- **Services / Media**: `packages/application/src/services/media-upload-utils.ts` を新設。`resolveUploadTargetPath` / `isSafeRelativeUploadPath` / `normalizeRelativePath` を shared 化。tauri 側 `tauriMediaStorage` は shared collision resolution を利用し app 固有ロジックを縮退
- **Services / Backup**: `packages/application/src/services/backup-orchestration.ts` を新設。`ImportSourceZipInput` / `ImportSourceZipResult` の shared schema を定義し、server / tauri の `importSourceZip` 引数形状を統一
- **Services / AI Tagging**: `packages/application/src/services/tag-persistence.ts` を新設。`persistTaggingResponse` 関数で tag / character / IP の AI 結果永続化ロジックを shared 化。server 側 `TaggingService.saveTags` と tauri 側 `TauriAiService.persistAiTags` を統合し、両 app が同じ repository interface 経由で永続化
- **Services対応度**: ~72% → **~95%** に更新。主要サービス（CRUD / media / backup / ai tagging）が shared contract を経由。残る未共通化は platform 固有 I/O（zip stream / HTTP URL / storage driver）とレガシーサービスに限定

## 前回からの主な変更点（2026-04-30更新 — Components & Upload Collision）

- **Components**: `packages/ui/src/media-list-actions.tsx` を新設。server / tauri の `media-list-actions.tsx` はバイト一致だったが app 側で個別定義されていた。`presetClient` を prop 化して shared component へ抽出し、両 app の route から削除。app 側は `presetClient={PresetClient}` を prop 注入する thin wrapper に縮退
- **Services / Media**: `packages/application/src/services/media-upload-utils.ts` の `resolveUploadTargetPath` に `skipIfEquals` オプションを追加。server 側 `server-media-storage.ts` の `saveFile` / `copyFile` と `download-jobs.ts` の `_resolveFinalPathWithAvoidance` を shared 関数に置き換え。命名規則を `stem-{n}` から `base_{n}` に統一（server 側の旧命名を正とする）
- **Services対応度**: ~95% を維持。upload collision resolution の共通化により、server / tauri の storage 層で platform 非依存の衝突解決ロジックが完全に共有化

## Parity 例外（意図的な差分）

| サービス                   | 存在する app | 理由                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thumbnail-service`        | server のみ  | HTTP URL 構築（`/api/sources/…/thumbnail`）vs Rust IPC サムネイル生成。transport 固有                                                                                                                                                                                                           |
| `directory-service`        | server のみ  | storage driver 抽象化（`getDriver(source)`）。tauri は local fs のみをサポート                                                                                                                                                                                                                  |
| `event-service`            | server のみ  | レガシー SSE wrapper。`SseManager` / Tauri event bus で代替済み。削除推奨                                                                                                                                                                                                                       |
| `directory-sync-service`   | server のみ  | tauri 側は `source-service.ts` の `syncLocalSource` で同等処理を実装。`inferMediaType` / `normalizeRelativePath` / `isHiddenPath` を `packages/core` に shared 化済み。残る差分は filesystem scan I/O（`tinyglobby` vs Tauri `fs.readdir`）と media 登録・イベント transport の platform 固有層 |
| `media-processing-service` | server のみ  | tauri 側は Rust commands (`media.rs` / `media_metadata.rs`) + `tauri-job-queue.ts` で同等処理を実装。`runProcessMediaJob` / `media-processing-job.ts` / `updateMediaContextMetadata` は shared 化済み                                                                                           |
| `job-dispatch-service`     | server のみ  | tauri 側は `tauri-job-queue.ts` + Rust backend 統合パイプラインで同等処理を実装。`createJobDispatcher` / `job-runtime.ts` は shared 化済み                                                                                                                                                      |

## 前回からの主な変更点（2026-04-30更新 — Phase 5: directory-sync / media-processing / job-dispatch 残差分整理）

- **Core / Media Utils**: `packages/core/src/domain/media/utils/media-type-utils.ts` に `inferMediaType(filePath, supportedExtensions)` を追加。config-driven なメディア種別判定ロジックを server / tauri で共有。server `directory-sync-service.ts` / `media-processing-service.ts`、tauri `source-service.ts` の inline 実装を shared 関数に置換
- **Core / Path Utils**: `packages/core/src/domain/media/utils/path-utils.ts` に `normalizeRelativePath` と `isHiddenPath` を追加。server `directory-sync-service.ts`、tauri `source-service.ts` の inline path 正規化・hidden ファイル判定を shared 関数に置換
- **Parity 例外明文化**: `directory-sync-service` / `media-processing-service` / `job-dispatch-service` が server-only である理由を wiki に明記。tauri 側は `syncLocalSource`（TS）+ Rust backend パイプライン（`media.rs` / `media_metadata.rs` / `watcher.rs`）で同等責務を実装しており、差分は platform 固有 I/O（`tinyglobby` vs Tauri `fs.readdir`、Node `ImageProcessor` vs Rust `image` crate、SSE vs Tauri event bus）に閉じる
- **Services対応度**: ~95% を維持。Phase 5 による shared 化は純粋関数（`inferMediaType` / `normalizeRelativePath` / `isHiddenPath`）の抽出に限定。orchestration 層（`registerAndProcess` / `syncMediaSource` / `processJob`）は platform 固有 I/O の注入が必要なため app 側に残す

## 新設 Shared ファイル

| ファイル                  | 配置先                                  | 役割                                                                                                       |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `media-upload-utils.ts`   | `packages/application/src/services/`    | upload collision resolution algorithm、path safety check、normalize                                        |
| `backup-orchestration.ts` | `packages/application/src/services/`    | `ImportSourceZipInput` / `ImportSourceZipResult` schema、backup 引数統一                                   |
| `tag-persistence.ts`      | `packages/application/src/services/`    | AI tagging 結果（tag / character / IP）の永続化ロジック                                                    |
| `media-type-utils.ts`     | `packages/core/src/domain/media/utils/` | `inferMediaType`（config-driven）、`getMediaTypeFromExtension`（hardcoded）、`getContentTypeFromExtension` |
| `path-utils.ts`           | `packages/core/src/domain/media/utils/` | `normalizeRelativePath`、`isHiddenPath`                                                                    |
| `query-options/*.ts`      | `packages/ui/src/query-options/`        | TanStack Query `queryOptions` builder、query key 定義、デフォルトキャッシュ設定の shared 化                |
