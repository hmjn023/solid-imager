# Tasks: DB操作関数のリファクタリング

**Input**: Design documents from `/home/hmjn/project/web/solid-imager/specs/010-docs-design-06/`
**Goal**: 既存のDB操作関数を `src/infrastructure/db/queries/` ディレクトリに集約し、データアクセスレイヤーを整理する。

## Phase 1: Setup

**Purpose**: リファクタリングに必要なディレクトリ構造を準備します。

- [x] T001 [SETUP] `src/infrastructure/db/` 内に `queries` ディレクトリを作成します。

---

## Phase 2: Integration Tests (Safety Net)

**Purpose**: リファクタリングによるデグレードを防ぐため、既存のDB関数の振る舞いを保証する統合テストを作成します。

**⚠️ CRITICAL**: TDDの原則に従い、これらのテストが先に失敗する（または対象の関数をまだテストしていない場合は、テストが正常に動作する）ことを確認してから、次のリファクタリングフェーズに進んでください。

- [x] T002 [P] [TEST] `mediaSources` のクエリ関数（CRUD）に対する統合テストを `src/tests/integration/queries/mediaSources.test.ts` に作成します。
- [x] T003 [P] [TEST] `medias` のクエリ関数（CRUD、検索）に対する統合テストを `src/tests/integration/queries/media.test.ts` に作成します。
- [x] T004 [P] [TEST] `tags` と `mediaTags` のクエリ関数に対する統合テストを `src/tests/integration/queries/tags.test.ts` に作成します。
- [x] T005 [P] [TEST] `categories` のクエリ関数（CRUD）に対する統合テストを `src/tests/integration/queries/categories.test.ts` に作成します。
- [x] T006 [P] [TEST] `ips` のクエリ関数（CRUD）に対する統合テストを `src/tests/integration/queries/ips.test.ts` に作成します。
- [x] T007 [P] [TEST] `characters` と `mediaCharacters` のクエリ関数に対する統合テストを `src/tests/integration/queries/characters.test.ts` に作成します。

**Checkpoint**: すべての主要なDB関数がテストでカバーされていることを確認します。

---

## Phase 3: Core Refactoring

**Purpose**: 既存の関数を新しい `queries` ディレクトリに移動し、アプリケーション全体のインポートパスを更新します。

- [x] T008 [REFACTOR] `mediaSources` の関数を `src/infrastructure/db/media-sources.ts` から `src/infrastructure/db/queries/mediaSources.ts` に移動します。
- [x] T009 [REFACTOR] `medias` の関数を `src/infrastructure/db/media.ts` から `src/infrastructure/db/queries/media.ts` に移動します。
- [x] T010 [REFACTOR] `tags`関連の関数を `src/infrastructure/db/media-tags.ts` から `src/infrastructure/db/queries/tags.ts` に移動します。
- [x] T011 [REFACTOR] `categories` の関数を `src/infrastructure/db/categories.ts` から `src/infrastructure/db/queries/categories.ts` に移動します。
- [x] T012 [REFACTOR] `ips` の関数を `src/infrastructure/db/ips.ts` から `src/infrastructure/db/queries/ips.ts` に移動します。
- [x] T013 [REFACTOR] `characters` の関数を `src/infrastructure/db/characters.ts` から `src/infrastructure/db/queries/characters.ts` に移動します。
- [x] T013a [REFACTOR] `users` の関数を `src/infrastructure/db/users.ts` から `src/infrastructure/db/queries/users.ts` に移動します。
- [x] T013b [REFACTOR] `collections` の関数を `src/infrastructure/db/collections.ts` から `src/infrastructure/db/queries/collections.ts` に移動します。
- [x] T013c [REFACTOR] `search` の関数を `src/infrastructure/db/search.ts` から `src/infrastructure/db/queries/search.ts` に移動します。
- [x] T013d [REFACTOR] `media-generation-info` の関数を `src/infrastructure/db/media-generation-info.ts` から `src/infrastructure/db/queries/media-generation-info.ts` に移動します。
- [x] T013e [REFACTOR] `media-random` の関数を `src/infrastructure/db/media-random.ts` から `src/infrastructure/db/queries/media-random.ts` に移動します。
- [x] T013f [REFACTOR] `media-recent` の関数を `src/infrastructure/db/media-recent.ts` から `src/infrastructure/db/queries/media-recent.ts` に移動します。
- [x] T013g [REFACTOR] `presets` の関数を `src/infrastructure/db/presets.ts` から `src/infrastructure/db/queries/presets.ts` に移動します。
- [x] T013h [REFACTOR] `jobs` の関数を `src/infrastructure/db/jobs.ts` から `src/infrastructure/db/queries/jobs.ts` に移動します。
- [x] T013i [REFACTOR] `bulk-operations` の関数を `src/infrastructure/db/bulk-operations.ts` から `src/infrastructure/db/queries/bulk-operations.ts` に移動します。
- [x] T014 [REFACTOR] **[重要]** 移動したすべての関数のインポート元を、アプリケーション全体で新しいパス (`~/infrastructure/db/queries/...`) に更新します。

**Checkpoint**: Phase 2で作成したすべてのテストが、リファクタリング後もパスすることを確認します。

---

## Phase 4: Finalization & Cleanup

**Purpose**: 実装の仕上げと、不要になったファイルのクリーンアップを行います。

- [x] T015 [POLISH] `src/infrastructure/db/queries/index.ts` を作成し、実装したすべてのクエリ関数を再エクスポートします。(Linterの`noBarrelFile`ルールに従い、最終的にファイルは削除されました)
- [x] T016 [CLEANUP] 関数が移動され空になった元のファイル（`media-sources.ts`, `media.ts` 等）を削除します。
- [x] T017 [VERIFY] `bun run test` を実行し、すべてのテストが最終的にパスすることを確認します。
